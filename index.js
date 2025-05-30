const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECURET_KEYS);
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
    // await client.connect();

    const database = client.db("hostel-management");
    const mealCollection = database.collection("meals");
    const userCollection = database.collection("users");
    const memberShipColletion = database.collection("plans");
    const paymentCollection = database.collection("payments");
    const requestCollection = database.collection("request");
    const reviewCollection = database.collection("reviews");

    // jwt token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
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

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        // console.log(decoded.email);
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after veryfiToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const isAdmin = await userCollection.findOne(query);
      if (!isAdmin) {
        res.status(403).send({ message: "forbidden token" });
      }
      next();
    };

    // ================= Meal related API ===============

    //Collect meals api
    app.get("/meals", async (req, res) => {
      const { search, category, minPrice, maxPrice } = req.query;

      // filter condation here
      let filderCondition = {};

      if (search) {
        filderCondition.title = {
          $regex: search,
          $options: "i",
        };
      }

      if (category) {
        filderCondition.category = category;
      }

      if (minPrice || maxPrice) {
        filderCondition.price = {};
        if (minPrice) {
          filderCondition.price.$gte = parseInt(minPrice);
        }
        if (maxPrice) {
          filderCondition.price.$lte = parseInt(maxPrice);
        }
      }

      const result = await mealCollection.find(filderCondition).toArray();
      res.send(result);
    });

    // meal sort by like and review_count
    app.get("/meals/sortOrder", verifyToken, verifyAdmin, async (req, res) => {
      const { sortBy = "likes", order = "desc" } = req.query;
      const sortOrder = order === "asc" ? 1 : -1;
      const result = await mealCollection
        .find()
        .sort({ [sortBy]: sortOrder })
        .toArray();
      res.send(result);
    });

    // store meal in database related api
    app.post("/meals", verifyToken, verifyAdmin, async (req, res) => {
      const meal = req.body;
      const result = await mealCollection.insertOne(meal);
      res.send(result);
    });

    // admin can delete meal related api
    app.delete(
      "/delete-meal/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await mealCollection.deleteOne(filter);
        res.send(result);
      }
    );

    // meal like relate api
    app.patch("/meal-like/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const totalLike = {
        $inc: {
          likes: 1,
        },
      };
      const result = await mealCollection.updateOne(query, totalLike);
      res.send(result);
    });

    // meal publish
    app.patch("/meal-publish/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          postTime: new Date(),
        },
      };
      const result = await mealCollection.updateOne(query, update);
      res.send(result);
    });

    // meal review related api
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // meal review collect form client related  api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.aggregate().toArray();
      res.send(result);
    });

    // meal review_count update api
    app.patch("/review_count/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const totalReview = {
        $inc: {
          reviews_count: 1,
        },
      };
      const result = await mealCollection.updateOne(query, totalReview);

      res.send(result);
    });

    // if want to delete review then use this api of user
    app.delete("/review-delete/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    // if want to delete review then use this api of admin
    app.delete(
      "/admin-delete-review/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params;
        console.log("admin deleted review id -->", id);

        const query = { _id: new ObjectId(id) };
        const result = await reviewCollection.deleteOne(query);
        res.send(result);
      }
    );

    // spacific addmin meal count related api
    app.get("/destributer-add-meals/:email", async (req, res) => {
      const email = req.params.email;
      const filter = {
        distributorEmail: email,
      };
      const result = await mealCollection.find(filter).toArray();
      res.send(result);
    });

    // meal review update api
    app.patch("/update-review/:id", async (req, res) => {
      const id = req.params.id;
      const { review } = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { review: review },
      };
      const result = await reviewCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // ================ request API ===================

    // user all requested  api
    app.get("/meal/request", verifyToken, async (req, res) => {
      const result = await requestCollection.find().toArray();
      res.send(result);
    });

    // user email meal requested api
    app.get("/meal/request/:email", async (req, res) => {
      const email = req.params.email;
      const query = { requestEmail: email };
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });

    // Meal request relative api
    app.post("/meal/request", async (req, res) => {
      const request = req.body;
      const result = await requestCollection.insertOne(request);
      res.send(result);
    });

    // Delete request Unlike meal api
    app.delete(`/delete/request-mela/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.deleteOne(query);
      res.send(result);
    });

    // request mile serve api form admin
    app.patch(
      "/request-served/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const status = req.body.status;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: status,
          },
        };

        const result = await requestCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    // request meal user name and email search api
    app.get(`/requester/search`, async (req, res) => {
      const query = req.query.value || "";

      let filter = {
        $or: [
          {
            userName: {
              $regex: query,
              $options: "i",
            },
          },
          {
            requestEmail: {
              $regex: query,
              $options: "i",
            },
          },
        ],
      };

      const result = await requestCollection.find(filter).toArray();
      res.send(result);
    });

    // specifice meal api
    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const meal = await mealCollection.findOne(query);
      res.send(meal);
    });

    // update meal related api
    app.patch("/meals/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedMealData = req.body;
      const query = { _id: new ObjectId(id) };
      const result = await mealCollection.updateOne(query, {
        $set: updatedMealData,
      });
      res.send(result);
    });

    // ================= User API =======================

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

    // general user api
    app.get("/general/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await userCollection.find(filter).toArray();
      res.send(result);
    });

    // users search api
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

    // user badge relate api
    app.patch("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const { badge } = req.body;

      const query = { email: email };

      const updatedDoc = {
        $set: {
          badge: badge,
        },
      };

      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // =============== Admin related api==================

    // check admin api
    app.get(
      "/users/admin/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

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

    // ==============Membership plans related api ================
    // mamber ship plan api
    app.get("/plans", async (req, res) => {
      const result = await memberShipColletion.find().toArray();
      res.send(result);
    });

    // specifice plan name api
    app.get("/plans/:plan_name", async (req, res) => {
      const planName = req.params.plan_name;
      const filter = { name: planName };
      const result = await memberShipColletion.find(filter).toArray();
      res.send(result);
    });

    // =============payment related Api=====================

    // payment info serve api
    app.get("/payment-hostory/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 1000); // amount conver in poisa
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const data = req.body;
      const result = await paymentCollection.insertOne(data);
      res.send(result);
    });

    // stats or analytics
    app.get("/admin-stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const meals = await mealCollection.estimatedDocumentCount();
      const requests = await requestCollection.estimatedDocumentCount();
      const reviews = await reviewCollection.estimatedDocumentCount();

      // revenue
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$amount",
              },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({ users, meals, requests, reviews, revenue });
    });

    // --------------------end-----------------
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// test get api
app.get("/", async (req, res) => {
  res.send("Hostel Management  is runing.....");
});

app.listen(port, () => {
  console.log(`Hostel Server PORT is ${port}`);
});
