const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 7000;

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aiyi0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    app.get("/users", async (req, res) => {
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
