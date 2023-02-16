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
    app.listen(3001, () => {
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

module.exports = app;
