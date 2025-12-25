// --- কনফিগারেশন ---
const SUPABASE_URL = "https://dnelzlyuhhxloysstnlg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZWx6bHl1aGh4bG95c3N0bmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTM4MjAsImV4cCI6MjA4MTQyOTgyMH0.jYdJM1FTJja_A5CdTN3C3FWlKd_0E1JgHyaM4767SLc";
const AGORA_APP_ID = "b745c3bbd91b475b873956413e2ae40e"; 
const CHANNEL_NAME = "poorbank_global_room"; // টেস্টিং এর জন্য ফিক্সড চ্যানেল

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
let localTracks = { videoTrack: null, audioTrack: null };

// --- অথেন্টিকেশন ও ইউজার লিস্ট ---
async function handleAuth(mode) {
    const email = document.getElementById('authEmail').value.trim();
    const name = document.getElementById('authName').value.trim();
    if (!email) return alert("ইমেইল দিন!");

    if (mode === 'signup') {
        await supabaseClient.from('user_accounts').insert([{ email, name, balance: 1000 }]);
        alert("সাইনআপ সফল!");
    } else {
        const { data } = await supabaseClient.from('user_accounts').select('*').eq('email', email).maybeSingle();
        if (data) {
            localStorage.setItem("userSession", data.email + " : " + data.name);
            location.reload(); 
        } else alert("অ্যাকাউন্ট নেই!");
    }
}

async function fetchUserList() {
    const myEmail = localStorage.getItem("userSession").split(" : ")[0];
    const { data } = await supabaseClient.from('user_accounts').select('name, email');
    const listContainer = document.getElementById('user-list-container');
    listContainer.innerHTML = "";
    data.forEach(user => {
        if (user.email !== myEmail) {
            const div = document.createElement('div');
            div.className = "user-item";
            div.innerHTML = `<span>${user.name}</span> 
                <div><button class='btn-green' onclick="makeCall('${user.email}', 'video')">🎥</button>
                <button class='btn-blue' onclick="makeCall('${user.email}', 'audio')">📞</button></div>`;
            listContainer.appendChild(div);
        }
    });
}

// --- কল নোটিফিকেশন ---
function listenForCalls() {
    const myEmail = localStorage.getItem("userSession").split(" : ")[0];
    supabaseClient.channel('calls').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, payload => {
        if (payload.new.receiver_email === myEmail) {
            if (confirm(`${payload.new.caller_email} কল দিচ্ছে। রিসিভ করবেন?`)) joinCall(payload.new.call_type);
        }
    }).subscribe();
}

async function makeCall(email, type) {
    const myEmail = localStorage.getItem("userSession").split(" : ")[0];
    await supabaseClient.from('calls').insert([{ caller_email: myEmail, receiver_email: email, call_type: type }]);
    joinCall(type);
}

// --- অডিও এবং ভিডিও কল ফিক্স ---
async function joinCall(type) {
    try {
        document.getElementById('ui-container').style.display = 'none';
        document.getElementById('leave-btn').style.display = 'block';

        // ১. জয়েন করা (টোকেন ছাড়া)
        await client.join(AGORA_APP_ID, CHANNEL_NAME, null, null);

        // ২. মাইক্রোফোন এবং ক্যামেরা ট্র্যাকিং
        if (type === 'video') {
            [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
            localTracks.videoTrack.play("local-player");
        } else {
            localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            document.getElementById('local-player').innerHTML = "<p style='color:white; margin-top:50px;'>Audio On</p>";
        }

        // ৩. পাবলিশ করা (যাতে অন্যজন শুনতে পায়)
        await client.publish(Object.values(localTracks).filter(t => t !== null));
        console.log("Published success!");

    } catch (err) {
        console.error(err);
        alert("ক্যামেরা/মাইক এরর! নিশ্চিত করুন আপনি HTTPS ব্যবহার করছেন এবং পারমিশন দিয়েছেন।");
        leaveCall();
    }
}

// ৪. অন্য পক্ষকে দেখা/শোনা
client.on("user-published", async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === "video") user.videoTrack.play("remote-player");
    if (mediaType === "audio") user.audioTrack.play();
});

async function leaveCall() {
    for (let track in localTracks) if (localTracks[track]) { localTracks[track].stop(); localTracks[track].close(); }
    await client.leave();
    location.reload();
}

function logout() { localStorage.clear(); location.reload(); }

window.onload = () => { 
    if (localStorage.getItem("userSession")) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'block';
        fetchUserList();
        listenForCalls();
        // ব্যালেন্স লোড (Optional)
    } else {
        document.getElementById('auth-section').style.display = 'block';
    }
};