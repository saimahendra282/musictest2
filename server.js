require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const Music = require('./models/Music'); // Import the updated Music model

const app = express();

// Middleware
const corsOptions = {
    origin: ['http://localhost:5173','https://saimusicv.netlify.app'], // Allow requests only from these two origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Allowed HTTP methods
    credentials: true // Allow credentials (e.g., cookies, authorization headers)
};
// const corsOptions = {
//     origin: '*', // Allow requests from any origin
//     methods: ['GET', 'POST','PUT','PATCH','DELETE'],
//     credentials: true
// };
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;

mongoose
    .connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('MongoDB ki connect ayyindhi'))
    .catch((err) => console.log('MongoDB connection error mama:', err));

const conn = mongoose.connection;

// Initialize GridFS
let gridfsBucket;
conn.once('open', () => {
    gridfsBucket = new GridFSBucket(conn.db, {
        bucketName: 'uploads',
    });
    console.log('GridFS successfully ga initialize ayyindhi.');
});


// Create Storage Engine using Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes

// @route POST /upload
// @desc  Upload an MP3 file and an image, then save metadata to the Music collection
app.post('/upload', upload.fields([{ name: 'pic' }, { name: 'audio' }]), async (req, res) => {
    try {
        const { name } = req.body;
        const { pic, audio } = req.files;

        if (!name || !pic || !audio) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const uploadToGridFS = (file, filename, mimetype) => {
            return new Promise((resolve, reject) => {
                const uploadStream = gridfsBucket.openUploadStream(filename, {
                    contentType: mimetype,
                });
                uploadStream.end(file.buffer);
                uploadStream.on('finish', () => resolve(uploadStream.id));
                uploadStream.on('error', reject);
            });
        };

        const picId = await uploadToGridFS(pic[0], `pic_${Date.now()}`, pic[0].mimetype);
        const audioId = await uploadToGridFS(audio[0], `audio_${Date.now()}`, audio[0].mimetype);

        const newMusic = new Music({
            name,
            picId,
            audioId,
        });

        const savedMusic = await newMusic.save();

        res.json({
            message: 'Music uploaded successfully',
            music: savedMusic,
        });
    } catch (err) {
        console.error('Error uploading files:', err);
        res.status(500).json({ message: 'Error uploading files.', error: err });
    }
});


// @route GET /music
// @desc  Retrieve all music metadata along with image and audio file details
app.get('/music', async (req, res) => {
    try {
        const musicList = await Music.find();

        // Prepare the response with URLs to access image and audio files
        const musicData = await Promise.all(
            musicList.map(async (music) => {
                try {
                    // Prepare URLs for image and audio using the appropriate route
                    const picUrl = `${req.protocol}://${req.get('host')}/file/${music.picId}`;
                    const audioUrl = `${req.protocol}://${req.get('host')}/file/${music.audioId}`;

                    return {
                        _id: music._id,
                        name: music.name,
                        picUrl,
                        audioUrl,
                    };
                } catch (err) {
                    console.error('Error retrieving files for music:', music.name, err);
                    return null; // Return null if there is an error with a specific file
                }
            })
        );

        // Filter out any null entries (if any error occurred during file retrieval)
        const filteredMusicData = musicData.filter(item => item !== null);

        res.json(filteredMusicData);
    } catch (err) {
        console.error('Error retrieving music list:', err);
        res.status(500).json({ message: 'Error retrieving music list.', error: err });
    }
});



 // @route GET /file/:id
// @desc  Retrieve file from GridFS by ID
app.get('/file/:id', (req, res) => {
    const fileId = req.params.id;

    const downloadStream = gridfsBucket.openDownloadStream(new mongoose.Types.ObjectId(fileId)); // Use `new`
    downloadStream.on('data', (chunk) => res.write(chunk));
    downloadStream.on('end', () => res.end());
    downloadStream.on('error', (err) => {
        console.error(err);
        res.status(404).json({ message: 'File not found' });
    });
});
// @route POST /login
// @desc  Validate key and return user details if key exists
app.post('/login', async (req, res) => {
    try {
        const { key } = req.body; // Get the key from the request body

        if (!key) {
            return res.status(400).json({ message: 'Key is required' });
        }

        // Query the User collection to check if the key exists
        const user = await conn.db.collection('user').findOne({ key });

        if (!user) {
            return res.status(404).json({ message: 'Invalid key. User not found.' });
        }

        // Return the key and username to the frontend
        res.json({
            message: 'Login Ok, Welcome',
            username: user.username,
        });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login.', error: err });
    }
});




// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
