// --------------- express app ----------------

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// ========== middleware ===========
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


// =========== mongodb ===========

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bphasys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// =============== verify with jwt token =================

const verifyJWT = (req, res, next) => {
    console.log('hitting jwt')
    console.log(req.headers.authorization)
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];
    console.log('jwt token split verify', token);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRETE, (error, decoded) => {
        if (error) {
            return res.status(403).send({ error: true, message: 'unauthorized access' })
        }
        else {
            req.decoded = decoded;
            next();
        }
    })
};





async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // ======= mongodb collection =========
        const userCollection = client.db('taskManagementApp').collection('users');
        const taskCollection = client.db('taskManagementApp').collection('tasks')


        // ========= json web token(jwt) ===========


        app.post('/jwt', async(req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRETE, { expiresIn: '24h' });

            res.send({ token });
        })







        //  ========= post user data to mongodb ===========
        app.post('/addUser', async (req, res) => {
            const userData = req.body;
            const result = await userCollection.insertOne(userData);
            res.send(result);
        });

        // ======== delete task ===========
        app.delete('/deleteTask', async (req, res) => {
            const id = req.query.id;
            const query = { _id: new ObjectId(id) }
            const result = await taskCollection.deleteOne(query);
            res.send(result);
        });

        // ======== load specific task for update =========
        app.get('/specificTask/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await taskCollection.findOne(query);
            res.send(result)
        });

        // ========= update task ===========
        app.patch('/updateTask', async (req, res) => {
            const id = req.query.id;
            const updateData = req.body;
            const { title, description, time } = updateData;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    title: title,
                    description: description,
                    time: time
                },
            };
            const result = await taskCollection.updateMany(filter, updateDoc);
            res.send(result);
        });

        // ========= update complete button ========
        app.patch('/completeTask', async (req, res) => {
            const id = req.query.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'complete'
                }
            }
            const result = await taskCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        // ========== for pagination (estimated task count) =============
        app.get('/taskCount', async (req, res) => {
            try {
                const email = req.query.email;
                const query = { email: email };

                const count = await taskCollection.countDocuments(query);

                res.send({ count });
            } catch (error) {
                res.status(500).send({ error: 'Error fetching task count' });
            }
        });


        // ============ load task from user(with pagination) ==========
        app.get('/task',verifyJWT, async (req, res) => {
            const query = req.query;
            // console.log('query',query)

            // ----------part of verifyJWT---------------
            const decoded = req.decoded;
            console.log('decode',decoded)
            console.log('query',req.query.email)
            if (decoded.email !== req.query?.email) {
                return res.status(403).send({ error: 1, message: 'forbidden access' })
            };
            console.log('decoded', req.query?.email)
            // -----------end of the part-----------


            // ====== pagination =========

            const page = parseInt(query.page);
            const size = parseInt(query.size);
            const email = req.query.email;
            // console.log('email', email)
            const result = await taskCollection.find({ email: email }).skip(page * size).limit(size).toArray();
            res.send(result);

        });

        // ======== post task to mongodb ==========
        app.post('/addTask', async (req, res) => {
            const taskData = req.body;
            const result = await taskCollection.insertOne(taskData);
            res.send(result)
        });
        app.get('/avatarLoad',async(req,res)=> {
            const email = req.query.email;
            const query = {email : email}
            const result = await userCollection.findOne(query);
            res.send(result);
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



// ======== root route ========
app.get('/', (req, res) => {
    res.send('task management application is running')
});


app.listen(port, () => {
    console.log(`task management app running on the port ${port}`)
});
