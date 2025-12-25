const SUPABASE_URL = "https://dnelzlyuhhxloysstnlg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZWx6bHl1aGh4bG95c3N0bmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTM4MjAsImV4cCI6MjA4MTQyOTgyMH0.jYdJM1FTJja_A5CdTN3C3FWlKd_0E1JgHyaM4767SLc";
const AGORA_APP_ID = "b745c3bbd91b475b873956413e2ae40e"; 
const CHANNEL_NAME = "poorbank_call_room";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
let localTracks = { videoTrack: null, audioTrack: null };

// --- অথেন্টিকেশন ---
async function handleAuth(mode) {
    const email = document.getElementById('authEmail').value.trim();
    const name = document.getElementById('authName').value.trim();

    if (!email) return alert("ইমেইল দিন!");

    if (mode === 'signup') {
        const { error } = await supabaseClient.from('user_accounts').insert([{ email, name, balance: 1000 }]);
        if (error) return alert("সাইনআপ ব্যর্থ! ইমেইলটি আগেই ব্যবহৃত।");
        alert("অ্যাকাউন্ট তৈরি! এখন লগইন করুন।");
    } else {
        const { data } = await supabaseClient.from('user_accounts').select('*').eq('email', email).maybeSingle();
        if (data) {
            localStorage.setItem("userSession", data.email + " : " + data.name);
            showDashboard();
        } else alert("অ্যাকাউন্ট পাওয়া যায়নি!");
    }
}

function showDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    loadUserData();
    fetchUserList();
    listenForCalls();
}

async function loadUserData() {
    const myEmail = localStorage.getItem("userSession").split(" : ")[0];
    const { data } = await supabaseClient.from('user_accounts').select('*').eq('email', myEmail).maybeSingle();
    if (data) {
        document.getElementById('userBalance').innerText = "৳ " + data.balance;
        document.getElementById('userNameDisplay').innerText = data.name;
    }
}

// --- ইউজার লিস্ট এবং কলিং ---
async function fetchUserList() {
    const myEmail = localStorage.getItem("userSession").split(" : ")[0];
    const { data } = await supabaseClient.from('user_accounts').select('name, email');
    const listContainer = document.getElementById('user-list-container');
    listContainer.innerHTML = "";

    data.forEach(user => {
        if (user.email !== myEmail) {
            const div = document.createElement('div');
            div.className = "user-item";
            div.innerHTML = `
                <span><strong>${user.name || 'User'}</strong></span>
                <div>
                    <button class="btn-green" onclick="makeCall('${user.email}', 'video')">🎥</button>
                    <button class="btn-blue" onclick="makeCall('${user.email}', 'audio')">📞</button>
                </div>`;
            listContainer.appendChild(div);
        }
    });
}

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

// --- অ্যাগোরা কল সিস্টেম ---
async function joinCall(type) {
    try {
        document.getElementById('ui-container').style.display = 'none'; // প্রাইভেসি: ড্যাশবোর্ড হাইড
        await client.join(AGORA_APP_ID, CHANNEL_NAME, null, null);

        if (type === 'video') {
            [localTracks.audioTrack, localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
            localTracks.videoTrack.play("local-player");
            await client.publish([localTracks.audioTrack, localTracks.videoTrack]);
        } else {
            localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            await client.publish([localTracks.audioTrack]);
            document.getElementById('local-player').innerHTML = "<div style='color:white; font-size:10px; padding:20px;'>Talking...</div>";
        }
        document.getElementById('leave-btn').style.display = 'block';
    } catch (err) { leaveCall(); }
}

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
    if (localStorage.getItem("userSession")) showDashboard(); 
    else document.getElementById('auth-section').style.display = 'block'; 
};