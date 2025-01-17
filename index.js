const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 7000;

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aiyi0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const privateKey = process.env.ACCESS_TOKEN_SECRET;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const database = client.db("hostel-management");
    const mealCollection = database.collection("meals");
    const userCollection = database.collection("users");
    const memberShipColletion = database.collection("plans");

    // jwt token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, privateKey, {
        expiresIn: "2h",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, privateKey, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        // console.log(decoded.email);
        req.decoded = decoded;
        next();
      });
    };

    //Collect meals api
    app.get("/meals", async (req, res) => {
      const result = await mealCollection.find().toArray();
      res.send(result);
    });

    // users api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      const isExistUser = await userCollection.findOne(query);

      if (isExistUser) {
        return res.send({
          message: "User already have an account",
          insertedId: null,
        });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // users api
    app.get("/users", verifyToken, async (req, res) => {
      const userName = req.query.name;
      const email = req.query.email;

      let query = {};

      if (userName) {
        query = {
          $or: [
            {
              name: {
                $regex: userName,
                $options: "i",
              },
            },
            {
              email: {
                $regex: email,
                $options: "i",
              },
            },
          ],
        };
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // users admin api
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // mamber ship plan api
    app.get("/plans", async (req, res) => {
      const result = await memberShipColletion.find().toArray();
      res.send(result);
    });

    // make admin api
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// test get api
app.get("/", async (req, res) => {
  res.send("Hostel Management  is commig.....");
});

app.listen(port, () => {
  console.log(`Hostel Server PORT is ${port}`);
});
