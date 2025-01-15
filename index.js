require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000


app.use(express.json())
app.use(cors())


const { configDotenv } = require('dotenv');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.pqwog.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const database = client.db("bistroDB");
    const menuCollection = database.collection("menus");
    const reviewsCollection = database.collection("reviews");
    const cartsCollection = database.collection("carts");
    const userCollection = database.collection("users");
    const paymentCollection = database.collection("payments");

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body; //called as data or payload 
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
      res.send({ token });
    })

    //jwt -middleware
    const verifyToken = (req, res, next) => {
      // console.log(req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorised access' });
      }

      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorised access' });
        }
console.log('req.decoded', req.decoded)
console.log('decoded', decoded)
        req.decoded = decoded;
        next();
      });
    }
    //use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";

      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden admin access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "Admin";
      };
      res.send({ admin });
    })


    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "Admin"
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      //insert email if user doesnt exists
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null, })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })
    app.post("/carts", async (req, res) => {
      const cartItem = req.body
      const result = await cartsCollection.insertOne(cartItem)
      res.send(result)
    })

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartsCollection.find(query).toArray()
      res.send(result)
    })

    app.get("/menus", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result)
    })

    app.post("/menus", verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result)
    })
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result)
    })

    app.patch("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        }
      }
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    //Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })


    })

    app.get("/payments/:email",verifyToken, async(req,res)=>{
      const query={email:req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: "forbidden access"})
      }
      const result=await paymentCollection.find(query).toArray();
      res.send(result)
    })

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment)
      console.log('payment info', payment)

      //carefully delete items(paid for) from the cart
      const query = {
        _id: {
          $in: payment.cartIds.map(id => ObjectId.createFromHexString(id))
        }
      }
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult })
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Server Running Successfully")
})

app.listen(port, () => { console.log(`Server is running @port ${port}`) })