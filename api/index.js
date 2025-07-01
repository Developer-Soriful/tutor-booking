import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { createRequire } from "module";
import dotenv from "dotenv";
const require = createRequire(import.meta.url);
const serviceAccount = require("../firebase/serviceAccountKey.json");
// commit 
const app = express();
const port = process.env.PORT || 3000;
dotenv.config();
// Middlewares
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://assignment-11-19334.web.app",
      "https://tutor-booking-jade.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

// Firebase Admin Initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB Configuration
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.xyvbdxk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Collections
const database = client.db("tutors");
const bookingDatabase = client.db("bookings");
const tutorsCollection = database.collection("tutors");
const bookingsCollection = bookingDatabase.collection("bookings");

// Token verification middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

// Static categories
const language_categories = [
  {
    id: 1,
    language: "english",
    title: "English tutors",
    teachers: "20,583 teachers",
    icon: "📘",
  },
  {
    id: 2,
    language: "spanish",
    title: "Spanish tutors",
    teachers: "8,538 teachers",
    icon: "📗",
  },
  {
    id: 3,
    language: "french",
    title: "French tutors",
    teachers: "6,282 teachers",
    icon: "📙",
  },
  {
    id: 4,
    language: "german",
    title: "German tutors",
    teachers: "5,112 teachers",
    icon: "📕",
  },
  {
    id: 5,
    language: "italian",
    title: "Italian tutors",
    teachers: "3,478 teachers",
    icon: "📒",
  },
  {
    id: 6,
    language: "chinese",
    title: "Chinese tutors",
    teachers: "7,029 teachers",
    icon: "📓",
  },
  {
    id: 7,
    language: "arabic",
    title: "Arabic tutors",
    teachers: "2,284 teachers",
    icon: "📔",
  },
  {
    id: 8,
    language: "japanese",
    title: "Japanese tutors",
    teachers: "1,524 teachers",
    icon: "📚",
  },
  {
    id: 9,
    language: "portuguese",
    title: "Portuguese tutors",
    teachers: "3,311 teachers",
    icon: "📖",
  },
];

// Connect MongoDB
async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully.");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}
connectDB();

// Routes

app.get("/language_categories", (req, res) => {
  res.json(language_categories);
});

app.get("/allFirebaseUsers", async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers();
    res.send(listUsers.users);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post("/addTutor", verifyToken, async (req, res) => {
  if (req.body.email !== req.user.email) {
    return res
      .status(403)
      .send("You are not authorized to perform this action");
  }
  const result = await tutorsCollection.insertOne(req.body);
  res.send(result);
});

app.get("/allTutors", verifyToken, async (req, res) => {
  const result = await tutorsCollection.find().toArray();
  res.send(result);
});

app.get("/myAddedTutorials", verifyToken, async (req, res) => {
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const myTutorials = await tutorsCollection.find({ email }).toArray();
  res.send(myTutorials);
});

app.get("/tutorDetails/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const tutorDetails = await tutorsCollection.findOne({
    _id: new ObjectId(id),
  });
  if (!tutorDetails) {
    return res.status(404).send({ error: "Tutor not found" });
  }
  res.send(tutorDetails);
});

app.patch("/updateTutor/:id", async (req, res) => {
  const id = req.params.id;
  const email = req.body;

  const filter = {
    _id: new ObjectId(id),
    reviewedUser: { $ne: email },
  };

  const updateDoc = {
    $inc: { reviewCount: 1 },
    $push: { reviewedUser: email },
  };

  const updateReview = await bookingsCollection.updateOne(filter, updateDoc);

  if (updateReview.modifiedCount > 0) {
    const findTutor = await bookingsCollection.findOne({
      _id: new ObjectId(id),
    });
    const tutorUpdate = await tutorsCollection.updateMany(
      { email: findTutor.email },
      { $set: { reviewCount: findTutor.reviewCount } }
    );
    return res.send({ updateReview, tutorUpdate });
  } else {
    res.send({ message: "You have already reviewed" });
  }
});

app.post("/bookTutor", async (req, res) => {
  const result = await bookingsCollection.insertOne(req.body);
  res.send(result);
});

app.get("/allBookings", verifyToken, async (req, res) => {
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(403).send({ message: "Forbidden access" });
  }
  const result = await bookingsCollection
    .find({ selfBooking: email })
    .toArray();
  res.send(result);
});

app.put("/updateTutorialData/:id", async (req, res) => {
  const id = req.params.id;
  const result = await tutorsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: req.body }
  );
  res.send(result);
});

app.delete("/deleteTutorial/:id", async (req, res) => {
  const id = req.params.id;
  const result = await tutorsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});
// Add this route after your existing routes
app.get("/searchTutors", async (req, res) => {
  try {
    const { language } = req.query;

    if (!language || language.trim() === "") {
      // If no search term, return all tutors
      const result = await tutorsCollection.find().toArray();
      return res.send(result);
    }

    // Case-insensitive search using regex
    const searchRegex = new RegExp(language, 'i');
    const result = await tutorsCollection.find({
      language: searchRegex
    }).toArray();

    res.send(result);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).send({ error: "Search failed" });
  }
});
app.get("/", async (req, res) => {
  res.send("Hello World!");
});

// 404 handler (must be last)
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;

// done this project
// end
