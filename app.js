const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const databasePath = path.join(__dirname, "twitterClone.db");
let database;

// initializing Database And Server

const initializeDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

// API 1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const isUserPresentQuery = `SELECT * FROM user WHERE username='${username}';`;
  const isUserPresent = await database.get(isUserPresentQuery);
  if (isUserPresent !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `INSERT INTO 
      user(name,username,password,gender) 
      VALUES ('${name}','${username}','${hashedPassword}','${gender}');`;
      await database.run(createUserQuery);
      console.log(1);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

// API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const user = await database.get(selectUserQuery);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (isPasswordCorrect === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = await jwt.sign(payload, "shhhhh");
      response.status(200);
      let token = { jwtToken };
      console.log(token);
      response.send({ jwtToken });
    }
  }
});

// Authentication with JWT Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  console.log(jwtToken);
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "shhhhh", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 3

app.get(
  "/user/tweets/feed/",
  authenticateToken,
  async (request, response) => {}
);

// API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getFollowingQuery = `SELECT name 
    FROM 
    (SELECT follower.following_user_id 
        FROM user 
        INNER JOIN follower 
        ON user.user_id=follower.follower_user_id 
        WHERE user.username='${username}') AS t1 
    INNER JOIN user 
    ON t1.following_user_id=user.user_id;`;
  const followersList = await database.all(getFollowingQuery);
  console.log(followersList);
  response.send(followersList);
});

// API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getFollowingQuery = `SELECT name 
    FROM 
    (SELECT follower.follower_user_id 
        FROM user 
        INNER JOIN follower 
        ON user.user_id=follower.following_user_id 
        WHERE user.username='${username}') AS t1 
    INNER JOIN user 
    ON t1.follower_user_id=user.user_id;`;
  const followersList = await database.all(getFollowingQuery);
  console.log(followersList);
  response.send(followersList);
});

//API 6

const responseTweet = (tweet) => {
  return {
    tweet: tweet.tweet,
    likes: tweet.likes,
    replies: tweet.replies,
    dateTime: tweet.dateTime,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getUserFollowing = `select t4.tweet as tweet,count(like.like_id) as likes,t4.replies as replies,t4.date_time as dateTime 
  from (select t3.user_id,t3.tweet_id,t3.tweet,t3.date_time,count(reply.reply_id) as replies 
  from (select * from (SELECT user.user_id 
  FROM (SELECT follower.following_user_id 
  FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id 
  WHERE user.username='${username}') AS t1 
  INNER JOIN user ON t1.following_user_id=user.user_id) as t2 
  inner join tweet on t2.user_id=tweet.user_id where tweet.tweet_id=${tweetId}) as t3 
  inner join reply on t3.tweet_id=reply.tweet_id) as t4 
  inner join like on t4.tweet_id=like.tweet_id;`;
  const tweet = await database.all(getUserFollowing);
  if (tweet.tweet === null) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const tweet1 = responseTweet(tweet);
    console.log(tweet1);
    response.send(tweet1);
  }
});

// API 7

const responseLikes = (likes) => {
  let likesArray = [];
  for (let i of likes) {
    likesArray.push(i.name);
  }
  return { likes: likesArray };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserFollowingTweetLikesQuery = `select name from
    (select like.user_id as user_id from 
        (select tweet_id from 
            (select user_id,following_user_id as following from user inner join follower 
            on user.user_id = follower.follower_user_id where username='${username}') 
        as t1 inner join tweet on t1.following=tweet.user_id where tweet_id=${tweetId}) 
    as t2 inner join like on t2.tweet_id=like.tweet_id) 
    as t3 inner join user on t3.user_id=user.user_id;`;
    const likes = await database.all(getUserFollowingTweetLikesQuery);
    if (likes === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(responseLikes(likes));
    }
  }
);

//API 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserFollowingTweetReplyQuery = `select name,reply from
      (select reply.user_id as user_id,reply.reply as reply from 
        (select tweet_id from 
            (select user_id,following_user_id as following from user 
            inner join follower on user.user_id = follower.follower_user_id where username='${username}') as t1 
            inner join tweet on t1.following=tweet.user_id where tweet_id=${tweetId}) as t2 
            inner join reply on t2.tweet_id=reply.tweet_id) as t3 
            inner join user on t3.user_id=user.user_id;`;
    const replies = await database.all(getUserFollowingTweetReplyQuery);
    if (replies === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(replies);
    }
  }
);

//API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserTweets = `select t2.tweet as tweet,count(distinct t3.like_id)as likes,count(distinct t3.reply_id) as replies, t2.date_time as dateTime from
    (select tweet_id,tweet,date_time from 
        (select user_id from user where username='${username}') as t1 
        inner join tweet on t1.user_id=tweet.user_id) as t2 
        inner join (select reply.tweet_id,reply.reply_id,like.like_id from reply 
            inner join like on reply.tweet_id=like.tweet_id)as t3 
            on t2.tweet_id=t3.tweet_id group by t2.tweet_id;`;
  const tweets = await database.all(getUserTweets);
  response.send(tweets);
});

//API 10

app.post("/user/tweets/", authenticateToken, (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
});

module.exports = app;
