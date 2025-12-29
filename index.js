require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const mongoose = require('mongoose'); 
const User = require('./models/User'); 

const app = express();
const PORT = 5000;

app.use(bodyParser.json());

// REPLACE THIS WITH THE LONG TOKEN YOU COPIED FROM THE DASHBOARD
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "PASTE_YOUR_LONG_TOKEN_HERE";

// KEEP THIS MATCHING YOUR DASHBOARD VERIFY TOKEN
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_secret_password_123";

// --- DATABASE CONNECTION ---
//mongoose.connect('mongodb://127.0.0.1:27017/shoplink_db')
// This tells the app: "Use the Cloud DB if available, otherwise use Local DB"
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shoplink_db')
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));
// --------------------------------

// 1. The Verification Route
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 2. The Listener Route
app.post('/webhook', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(async function(entry) {
            
            let webhook_event = entry.messaging[0];
            
            if(webhook_event) {
                console.log("SENDER ID:", webhook_event.sender.id);
                let sender_psid = webhook_event.sender.id;

                // --- DATABASE LOGIC ---
                try {
                    let user = await User.findOne({ psid: sender_psid });
                    if (!user) {
                        console.log("New User detected! Saving to DB...");
                        user = new User({ psid: sender_psid });
                        await user.save();
                        console.log("✅ User saved to DB!");
                    } else {
                        console.log("ℹ️ User found in DB.");
                    }
                } catch (err) {
                    console.error("Database Error:", err);
                }

                // --- EVENT HANDLING ---
                // Check if it is a TEXT MESSAGE or a BUTTON CLICK (Postback)
                if (webhook_event.message) {
                    handleMessage(sender_psid, webhook_event.message);
                } else if (webhook_event.postback) {
                    handlePostback(sender_psid, webhook_event.postback);
                }
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// ---------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------

// Function 1: Handle Text Messages
function handleMessage(sender_psid, received_message) {
    let response;

    // Check if the message contains text
    if (received_message.text) {
        let text = received_message.text.toLowerCase();

        // If user says "hi" or "menu", show the Welcome Card
        if (text.includes("hi") || text.includes("hello") || text.includes("menu")) {
            console.log("Sending Welcome Menu...");
            sendWelcomeMessage(sender_psid);
        } else {
            // Otherwise just echo the text
            response = { "text": `You sent: "${received_message.text}". Type "menu" to see options!` };
            callSendAPI(sender_psid, response);
        }
    }
}

// Function 2: Handle Button Clicks (Postbacks)
function handlePostback(sender_psid, received_postback) {
    let payload = received_postback.payload;
    console.log("Button Clicked with Payload:", payload);

    if (payload === 'VIEW_PRODUCTS') {
        callSendAPI(sender_psid, { "text": "🛍️ Here are our top products:" });
        sendProductCarousel(sender_psid);
    } else if (payload === 'CONTACT_SUPPORT') {
        callSendAPI(sender_psid, { "text": "📞 A support agent will be with you shortly." });
    } else if (payload === 'BUY_TSHIRT') {
        callSendAPI(sender_psid, { "text": "Great choice! The T-Shirt has been added to your cart." });
    } else if (payload === 'BUY_HOODIE') {
        callSendAPI(sender_psid, { "text": "Nice! The Hoodie is now in your cart." });
    }
}

// Function 3: Send the "Welcome" Card
function sendWelcomeMessage(sender_psid) {
    let response = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": "Welcome to ShopLink!",
                    "image_url": "https://img.freepik.com/free-vector/shopping-online-concept-flat-design_1150-5154.jpg", 
                    "subtitle": "Your one-stop shop for everything.",
                    "buttons": [
                        {
                            "type": "postback",
                            "title": "🛍️ View Products",
                            "payload": "VIEW_PRODUCTS"
                        },
                        {
                            "type": "postback",
                            "title": "📞 Contact Support",
                            "payload": "CONTACT_SUPPORT"
                        }
                    ]
                }]
            }
        }
    };
    callSendAPI(sender_psid, response);
}

// Function 4: Send the "Product Carousel"
function sendProductCarousel(sender_psid) {
    let response = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [
                    {
                        "title": "Classic T-Shirt",
                        "image_url": "https://img.freepik.com/free-psd/isolated-white-t-shirt-front-view_125540-1194.jpg",
                        "subtitle": "Price: $25.00",
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Buy Now",
                                "payload": "BUY_TSHIRT"
                            }
                        ]
                    },
                    {
                        "title": "Stylish Hoodie",
                        "image_url": "https://img.freepik.com/free-psd/hoodie-mockup-isolated_1310-1563.jpg",
                        "subtitle": "Price: $50.00",
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Buy Now",
                                "payload": "BUY_HOODIE"
                            }
                        ]
                    }
                ]
            }
        }
    };
    callSendAPI(sender_psid, response);
}

// Function 5: Send API (Sends the request to Facebook)
function callSendAPI(sender_psid, response) {
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    };

    request({
        "uri": "https://graph.facebook.com/v21.0/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('Message sent!');
        } else {
            console.error('Unable to send message:' + err);
        }
    });
}

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));