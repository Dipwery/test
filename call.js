// আপনার Agora App ID এখানে বসান
const APP_ID = "b745c3bbd91b475b873956413e2ae40e"; 
const CHANNEL = "poorbank_main_room"; // চ্যানেলের নাম সবার জন্য এক হতে হবে
const TOKEN = '007eJxTYJCZzbHBV/H27eDt8bNVz0zcfm+mqd45IevwKz5Zk7fPfqinwJBkbmKabJyUlGJpmGRibppkYW5saWpmYmicapSYamKQGiXgm9kQyMiwqtyVlZEBAkF8IYaC/PyipMS87PjcxMy8+KL8/FwGBgABcyQu'; // টেস্টিং মোডে থাকলে এটি null রাখা যায়

let client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
let localTracks = { videoTrack: null, audioTrack: null };
let remoteUsers = {};

// --- ১. কল শুরু করা ---
async function startCall() {
    try {
        // Agora চ্যানেলে জয়েন করা
        await client.join(APP_ID, CHANNEL, TOKEN, null);

        // অডিও এবং ভিডিও ক্যামেরা অন করা
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();

        // নিজের ভিডিও প্লে করা
        localTracks.videoTrack.play("local-player");

        // সার্ভারে পাবলিশ করা যাতে অন্যরা দেখতে পায়
        await client.publish([localTracks.audioTrack, localTracks.videoTrack]);

        document.getElementById('join-btn').style.display = 'none';
        document.getElementById('leave-btn').style.display = 'inline-block';
        
        alert("কল শুরু হয়েছে!");
    } catch (error) {
        console.error("Error joining call:", error);
        alert("ক্যামেরা বা মাইক্রোফোন পারমিশন দিন!");
    }
}

// --- ২. অন্য ইউজার জয়েন করলে তা ধরা ---
client.on("user-published", async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    console.log("Remote user connected!");

    if (mediaType === "video") {
        // অন্য ইউজারের ভিডিও প্লে করা
        user.videoTrack.play("remote-player");
    }
    if (mediaType === "audio") {
        user.audioTrack.play();
    }
});

// যখন অন্য ইউজার কল কেটে দিবে
client.on("user-left", (user) => {
    console.log("Remote user left the call.");
    // রিমোট প্লেয়ার খালি করা
    document.getElementById("remote-player").innerHTML = '<span style="color:white; position:absolute; bottom:5px; left:5px; z-index:10;">User Disconnected</span>';
});

// --- ৩. কল শেষ করা ---
async function leaveCall() {
    for (let trackName in localTracks) {
        let track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = null;
        }
    }

    await client.leave();
    
    document.getElementById('join-btn').style.display = 'inline-block';
    document.getElementById('leave-btn').style.display = 'none';
    document.getElementById('local-player').innerHTML = '<span style="color:white; position:absolute; bottom:5px; left:5px; z-index:10;">You</span>';
    
    alert("কল শেষ হয়েছে।");
}