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
    origin: ['http://localhost:5173', 'https://saimusicv0.netlify.app/'], // Allow requests only from these two origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Allowed HTTP methods
    credentials: true // Allow credentials (e.g., cookies, authorization headers)
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

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
app.post('/upload', async (req, res) => {
    try {
        const { name, pic, audio } = req.body;

        if (!pic || !audio) {
            return res.status(400).json({ message: 'I WANT BOTH MP3 AND IMG FILES IDIOT.' });
        }

        // Decode the base64-encoded files
        const picBuffer = Buffer.from(pic.split(',')[1], 'base64'); // Remove base64 header and decode
        const audioBuffer = Buffer.from(audio.split(',')[1], 'base64'); // Remove base64 header and decode

        // Function to upload file to GridFS
        const uploadToGridFS = (fileBuffer, filename, mimetype) => {
            return new Promise((resolve, reject) => {
                const uploadStream = gridfsBucket.openUploadStream(filename, {
                    contentType: mimetype,
                });
                uploadStream.end(fileBuffer);
                uploadStream.on('finish', () => {
                    resolve(uploadStream.id);
                });
                uploadStream.on('error', reject);
            });
        };

        // Upload files to GridFS
        const picId = await uploadToGridFS(picBuffer, 'pic_' + Date.now(), 'image/jpeg'); // Assume JPEG image
        const audioId = await uploadToGridFS(audioBuffer, 'audio_' + Date.now(), 'audio/mpeg'); // Assume MP3 audio

        // Save metadata to Music collection
        const newMusic = new Music({
            name,
            picId,
            audioId,
        });
        const savedMusic = await newMusic.save();

        res.json({
            message: 'Hmm success bro! DB Loki upload chesesa',
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
