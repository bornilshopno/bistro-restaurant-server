require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app=express()
const port= process.env.PORT || 5000


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

    app.post("/carts", async(req,res)=>{
      const cartItem=req.body
      const result= await cartsCollection.insertOne(cartItem)
      res.send(result)
    })

    app.get("/carts", async(req,res)=>{
      const email=req.query.email;
      const query={email:email}
      const result=await cartsCollection.find(query).toArray()
      res.send(result)
    })

    app.get("/menus" ,async(req,res)=>{
        const result = await menuCollection.find().toArray();
        res.send(result)
    })
    app.get("/reviews" ,async(req,res)=>{
        const result = await reviewsCollection.find().toArray();
        res.send(result)
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


app.get("/", (req,res)=>{
    res.send("Server Running Successfully")
})

app.listen(port,()=>{console.log(`Server is running @port ${port}`)})