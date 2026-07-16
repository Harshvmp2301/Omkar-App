import { useState, useEffect } from "react";
import { Play, BookOpen, Bell, BellRing, MapPin, User, Check, ExternalLink, Globe, BellOff, Mail, Facebook, Youtube, Send } from "lucide-react";

const C = {
  bg: "#170B10",
  panel: "#231219",
  panelLight: "#2C1620",
  gold: "#C9972C",
  goldBright: "#E8B84B",
  muted: "#B7A28A",
  ivory: "#F3E9D6",
  line: "rgba(201,151,44,0.22)",
};

// Full bilingual content
const translations = {
  en: {
    appName: "OMKAR SAMITHI",
    tagline: "Muscat, Oman · Programs & Community",
    contentHub: "Content Hub",
    events: "Events",
    programsRecordings: "Programs & Recordings",
    fromBlog: "From the Blog",
    festivalNotes: "Festival Notes",
    upcomingPrograms: "Upcoming Programs",
    rsvp: "RSVP",
    going: "Going",
    remindersOn: "Reminders on",
    remindersOff: "Reminders off",
    pranaams: "Pranaams · Omkar Samithi",
    diyaHint: "The next lit diya marks your soonest upcoming program",
    sampleLayout: "Sample layout — connect YouTube Data API for live videos",
    sampleDates: "Sample dates — connect a real calendar to go live",
    rsvpCount: "You're RSVP'd to",
    program: "program",
    programs: "programs",
    toggleLanguage: "Toggle Language",
    enableNotifications: "Enable Notifications",
    notificationsEnabled: "Notifications Enabled!",
    notificationsDisabled: "Notifications Disabled",
    notificationTitle: "Omkar Samithi Reminder",
    notificationBody: "Don't forget the upcoming program: ",
    permissionDenied: "Please allow notifications in your browser settings",
    contactUs: "Contact Us",
    contactMethods: "You may contact us by one of the following methods:",
    emailUs: "By sending email on",
    feedbackForm: "By filling below Form and submitting",
    eventsList: [
      { id: "e1", day: "27", mon: "OCT", title: "Omkar Jnanamrutha", guest: "Smt. Amrutha Naidu", venue: "Sri Krishna Temple, Darsait, Muscat" },
      { id: "e2", day: "—", mon: "2026", title: "Omkar Naadamrutha", guest: "Guest TBA", venue: "Sri Krishna Temple, Darsait, Muscat" },
      { id: "e3", day: "—", mon: "2026", title: "Sri Anjaneya Pooje", guest: "Guest TBA", venue: "Sri Krishna Temple, Darsait, Muscat" },
    ],
    videos: [
  { 
    id: "v1", 
    title: "Omkar Aanjaneya Pooja Mahotsava - 2025", 
    date: "2025", 
    tag: "Recording", 
    url: "https://www.youtube.com/watch?v=l86Aq8Pskog",
    thumbnail: "https://img.youtube.com/vi/l86Aq8Pskog/maxresdefault.jpg"
  },
  { 
    id: "v2", 
    title: "Omkar Nadamrutha 2025 Quick Video", 
    date: "Sep 2025", 
    tag: "Recording", 
    url: "https://www.youtube.com/watch?v=e9OnjNAprrs",
    thumbnail: "https://img.youtube.com/vi/e9OnjNAprrs/maxresdefault.jpg"
  },
  { 
    id: "v3", 
    title: "Omkar Jnaanamrutha-2026 by Smt Amrutha Naidu", 
    date: "2026", 
    tag: "Recording", 
    url: "https://www.youtube.com/watch?v=6PzfWS11L1E",
    thumbnail: "https://img.youtube.com/vi/6PzfWS11L1E/maxresdefault.jpg"
  },
],
    blogPosts: [
      {
        id: "b1",
        title: "Omkar Jnanamrutha 2026",
        snippet: "Details of the discourse held in Muscat, dedicated to Sri Anjaneya Swamy.",
        url: "https://omkarsamithi.blogspot.com/2026/03/blog-post.html",
      },
      {
        id: "b2",
        title: "Omkar Naadamrutha 2024",
        snippet: "A musical evening program held at Muscat on October 27, 2024.",
        url: "https://omkarsamithi.blogspot.com/2024/09/omkar-naadamrutha-2024.html",
      },
      {
        id: "b3",
        title: "Omkar Anjaneya Pooja 2023",
        snippet: "Recap of the grand Sri Anjaneya Swamy pooja celebrated in Muscat.",
        url: "https://omkarsamithi.blogspot.com/2023/12/omkar-anjaneya-pooja-mahotsava-2023.html",
      },
    ],
    festivalPosts: [
      {
        id: "f1",
        title: "Akshaya Tritiya",
        snippet: "Why this Vaishakha lunar day is considered one of Hinduism's most auspicious for new beginnings.",
        url: "https://omkarsandesh.blogspot.com/2014/05/blog-post.html",
      },
      {
        id: "f2",
        title: "Maha Shivaratri",
        snippet: "The significance of the night-long vigil and fast observed by Shiva devotees.",
        url: "https://omkarsandesh.blogspot.com/2014/02/blog-post_26.html",
      },
      {
        id: "f3",
        title: "Makara Sankranti",
        snippet: "Marking the sun's transition into Capricorn and the start of Uttarayana.",
        url: "https://omkarsandesh.blogspot.com/2014/01/blog-post.html",
      },
      {
        id: "f4",
        title: "Gita Jayanti",
        snippet: "Commemorating the day Sri Krishna is believed to have imparted the Bhagavad Gita to Arjuna.",
        url: "https://omkarsandesh.blogspot.com/2013/12/blog-post_12.html",
      },
    ],
  },
  kn: {
    appName: "ಓಂಕಾರ ಸಮಿತಿ",
    tagline: "ಮಸ್ಕತ್, ಓಮನ್ · ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಸಮುದಾಯ",
    contentHub: "ವಿಷಯ ಕೇಂದ್ರ",
    events: "ಕಾರ್ಯಕ್ರಮಗಳು",
    programsRecordings: "ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ರೆಕಾರ್ಡಿಂಗ್ಗಳು",
    fromBlog: "ಬ್ಲಾಗ್‌ನಿಂದ",
    festivalNotes: "ಹಬ್ಬದ ಟಿಪ್ಪಣಿಗಳು",
    upcomingPrograms: "ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು",
    rsvp: "ಹಾಜರಿ",
    going: "ಹಾಜರಾಗುತ್ತೇನೆ",
    remindersOn: "ಜ್ಞಾಪನೆ ಆನ್",
    remindersOff: "ಜ್ಞಾಪನೆ ಆಫ್",
    pranaams: "ಪ್ರಣಾಮಗಳು · ಓಂಕಾರ ಸಮಿತಿ",
    diyaHint: "ಮುಂದಿನ ಉರಿಯುತ್ತಿರುವ ದೀಪವು ನಿಮ್ಮ ಮುಂದಿನ ಕಾರ್ಯಕ್ರಮವನ್ನು ಸೂಚಿಸುತ್ತದೆ",
    sampleLayout: "ಮಾದರಿ ವಿನ್ಯಾಸ — YouTube Data API ಮೂಲಕ ಲೈವ್ ವೀಡಿಯೊಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ",
    sampleDates: "ಮಾದರಿ ದಿನಾಂಕಗಳು — ನೈಜ ಕ್ಯಾಲೆಂಡರ್ ಸಂಪರ್ಕಿಸಿ",
    rsvpCount: "ನೀವು ಇವುಗಳಿಗೆ ಹಾಜರಿ ಸೂಚಿಸಿದ್ದೀರಿ",
    program: "ಕಾರ್ಯಕ್ರಮ",
    programs: "ಕಾರ್ಯಕ್ರಮಗಳು",
    toggleLanguage: "ಭಾಷೆ ಬದಲಾಯಿಸಿ",
    enableNotifications: "ಅಧಿಸೂಚನೆಗಳನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ",
    notificationsEnabled: "ಅಧಿಸೂಚನೆಗಳು ಸಕ್ರಿಯಗೊಂಡಿವೆ!",
    notificationsDisabled: "ಅಧಿಸೂಚನೆಗಳು ನಿಷ್ಕ್ರಿಯಗೊಂಡಿವೆ",
    notificationTitle: "ಓಂಕಾರ ಸಮಿತಿ ಜ್ಞಾಪನೆ",
    notificationBody: "ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮವನ್ನು ಮರೆಯಬೇಡಿ: ",
    permissionDenied: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅಧಿಸೂಚನೆಗಳನ್ನು ಅನುಮತಿಸಿ",
    contactUs: "ಸಂಪರ್ಕಿಸಿ",
    contactMethods: "ನೀವು ಈ ಕೆಳಗಿನ ವಿಧಾನಗಳಲ್ಲಿ ಒಂದರ ಮೂಲಕ ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಬಹುದು:",
    emailUs: "ಇ-ಮೇಲ್ ಕಳುಹಿಸಿ",
    feedbackForm: "ಕೆಳಗಿನ ಫಾರ್ಮ್ ಭರ್ತಿ ಮಾಡಿ ಸಲ್ಲಿಸಿ",
    eventsList: [
      { id: "e1", day: "೨೭", mon: "ಅಕ್ಟೋ", title: "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ", guest: "ಶ್ರೀಮತಿ ಅಮೃತಾ ನಾಯ್ಡು", venue: "ಶ್ರೀ ಕೃಷ್ಣ ದೇವಸ್ಥಾನ, ದಾರ್ಸೈತ್, ಮಸ್ಕತ್" },
      { id: "e2", day: "—", mon: "೨೦೨೬", title: "ಓಂಕಾರ ನಾದಾಮೃತ", guest: "ಅತಿಥಿ ಪ್ರಕಟಣೆ ಬಾಕಿ", venue: "ಶ್ರೀ ಕೃಷ್ಣ ದೇವಸ್ಥಾನ, ದಾರ್ಸೈತ್, ಮಸ್ಕತ್" },
      { id: "e3", day: "—", mon: "೨೦೨೬", title: "ಶ್ರೀ ಆಂಜನೇಯ ಪೂಜೆ", guest: "ಅತಿಥಿ ಪ್ರಕಟಣೆ ಬಾಕಿ", venue: "ಶ್ರೀ ಕೃಷ್ಣ ದೇವಸ್ಥಾನ, ದಾರ್ಸೈತ್, ಮಸ್ಕತ್" },
    ],
    videos: [
  { 
    id: "v1", 
    title: "ಓಂಕಾರ ಆಂಜನೇಯ ಪೂಜಾ ಮಹೋತ್ಸವ - ೨೦೨೫", 
    date: "೨೦೨೫", 
    tag: "ರೆಕಾರ್ಡಿಂಗ್", 
    url: "https://www.youtube.com/watch?v=l86Aq8Pskog",
    thumbnail: "https://img.youtube.com/vi/l86Aq8Pskog/maxresdefault.jpg"
  },
  { 
    id: "v2", 
    title: "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೫ ಕ್ವಿಕ್ ವೀಡಿಯೊ", 
    date: "ಸೆಪ್ಟೆಂ ೨೦೨೫", 
    tag: "ರೆಕಾರ್ಡಿಂಗ್", 
    url: "https://www.youtube.com/watch?v=e9OnjNAprrs",
    thumbnail: "https://img.youtube.com/vi/e9OnjNAprrs/maxresdefault.jpg"
  },
  { 
    id: "v3", 
    title: "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ-೨೦೨೬ ಶ್ರೀಮತಿ ಅಮೃತಾ ನಾಯ್ಡು", 
    date: "೨೦೨೬", 
    tag: "ರೆಕಾರ್ಡಿಂಗ್", 
    url: "https://www.youtube.com/watch?v=6PzfWS11L1E",
    thumbnail: "https://img.youtube.com/vi/6PzfWS11L1E/maxresdefault.jpg"
  },
],
    blogPosts: [
      {
        id: "b1",
        title: "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ - ೨೦೨೬",
        snippet: "ಮಸ್ಕತ್‌ನಲ್ಲಿ ನಡೆದ ಪ್ರವಚನದ ವಿವರಗಳು, ಶ್ರೀ ಆಂಜನೇಯ ಸ್ವಾಮಿಗೆ ಸಮರ್ಪಿತ.",
        url: "https://omkarsamithi.blogspot.com/2026/03/blog-post.html",
      },
      {
        id: "b2",
        title: "ಓಂಕಾರ ನಾದಾಮೃತ - ೨೦೨೪",
        snippet: "ಅಕ್ಟೋಬರ್ ೨೭, ೨೦೨೪ ರಂದು ಮಸ್ಕತ್‌ನಲ್ಲಿ ನಡೆದ ಸಂಗೀತ ಸಂಜೆ ಕಾರ್ಯಕ್ರಮ.",
        url: "https://omkarsamithi.blogspot.com/2024/09/omkar-naadamrutha-2024.html",
      },
      {
        id: "b3",
        title: "ಓಂಕಾರ ಆಂಜನೇಯ ಪೂಜೆ - ೨೦೨೩",
        snippet: "ಮಸ್ಕತ್‌ನಲ್ಲಿ ಆಚರಿಸಲಾದ ಶ್ರೀ ಆಂಜನೇಯ ಸ್ವಾಮಿ ಪೂಜೆಯ ಮರುಕಳಿಕೆ.",
        url: "https://omkarsamithi.blogspot.com/2023/12/omkar-anjaneya-pooja-mahotsava-2023.html",
      },
    ],
    festivalPosts: [
      {
        id: "f1",
        title: "ಅಕ್ಷಯ ತೃತೀಯ",
        snippet: "ವೈಶಾಖ ಮಾಸದ ಈ ಚಂದ್ರ ದಿನವು ಹಿಂದೂ ಧರ್ಮದಲ್ಲಿ ಹೊಸ ಆರಂಭಗಳಿಗೆ ಶುಭವೆಂದು ಪರಿಗಣಿಸಲ್ಪಡುತ್ತದೆ.",
        url: "https://omkarsandesh.blogspot.com/2014/05/blog-post.html",
      },
      {
        id: "f2",
        title: "ಮಹಾ ಶಿವರಾತ್ರಿ",
        snippet: "ಶಿವ ಭಕ್ತರು ಆಚರಿಸುವ ರಾತ್ರಿ ಜಾಗರಣೆ ಮತ್ತು ಉಪವಾಸದ ಮಹತ್ವ.",
        url: "https://omkarsandesh.blogspot.com/2014/02/blog-post_26.html",
      },
      {
        id: "f3",
        title: "ಮಕರ ಸಂಕ್ರಾಂತಿ",
        snippet: "ಸೂರ್ಯನು ಮಕರ ರಾಶಿಗೆ ಪ್ರವೇಶಿಸುವುದು ಮತ್ತು ಉತ್ತರಾಯಣದ ಆರಂಭ.",
        url: "https://omkarsandesh.blogspot.com/2014/01/blog-post.html",
      },
      {
        id: "f4",
        title: "ಗೀತಾ ಜಯಂತಿ",
        snippet: "ಶ್ರೀ ಕೃಷ್ಣನು ಅರ್ಜುನನಿಗೆ ಭಗವದ್ಗೀತೆಯನ್ನು ಉಪದೇಶಿಸಿದ ದಿನದ ಸ್ಮರಣೆ.",
        url: "https://omkarsandesh.blogspot.com/2013/12/blog-post_12.html",
      },
    ],
  }
};

function Diya({ lit, onClick, label }) {
  return (
    <button onClick={onClick} title={label} className="diya-btn">
      <svg width="22" height="26" viewBox="0 0 22 26">
        <ellipse cx="11" cy="21" rx="10" ry="4" fill={C.panelLight} stroke={C.gold} strokeWidth="1" />
        <path
          d="M11 6 C 8 10, 8 14, 11 16 C 14 14, 14 10, 11 6 Z"
          fill={lit ? C.goldBright : "transparent"}
          stroke={lit ? C.goldBright : C.muted}
          strokeWidth="1"
          className={lit ? "diya-flicker" : ""}
        />
      </svg>
    </button>
  );
}

export default function OmkarSamithiApp() {
  const [tab, setTab] = useState("hub");
  const [rsvps, setRsvps] = useState({});
  const [notify, setNotify] = useState({});
  const [toast, setToast] = useState("");
  const [lang, setLang] = useState("en");
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const t = translations[lang];
  const events = t.eventsList;
  const videos = t.videos;
  const blogPosts = t.blogPosts;
  const festivalPosts = t.festivalPosts;

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      flash("This browser doesn't support notifications");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === "granted") {
      setNotificationsEnabled(true);
      flash(t.notificationsEnabled);
      new Notification(t.notificationTitle, {
        body: "You'll now receive reminders for upcoming programs!",
        icon: "🔔"
      });
    } else {
      flash(t.permissionDenied);
    }
  };

  const sendNotification = (eventTitle) => {
    if (notificationsEnabled && notificationPermission === "granted") {
      new Notification(t.notificationTitle, {
        body: `${t.notificationBody} ${eventTitle}`,
        icon: "🪔",
        tag: "omkar-reminder",
        requireInteraction: true,
      });
    }
  };

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function toggleRsvp(id, title) {
    setRsvps((r) => {
      const next = { ...r, [id]: !r[id] };
      const msg = next[id] ? `RSVP'd for ${title}` : `RSVP cancelled for ${title}`;
      flash(msg);
      if (next[id]) {
        sendNotification(title);
      }
      return next;
    });
  }

  function toggleNotify(id, title) {
    setNotify((n) => {
      const next = { ...n, [id]: !n[id] };
      const msg = next[id] ? t.remindersOn : t.remindersOff;
      flash(`${msg} — ${title}`);
      if (next[id]) {
        sendNotification(title);
      }
      return next;
    });
  }

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  const rsvpCount = Object.values(rsvps).filter(Boolean).length;

  const toggleLanguage = () => {
    setLang(lang === "en" ? "kn" : "en");
    flash(lang === "en" ? "ಭಾಷೆ ಬದಲಾಯಿಸಲಾಗಿದೆ" : "Language changed");
  };

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Karla:wght@400;500;700&display=swap');

        * { box-sizing: border-box; }
        .video-thumb {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, ${C.panelLight}, ${C.bg});
  position: relative;
  overflow: hidden;
}
.video-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  transition: background 0.3s ease;
}
.video-card:hover .play-overlay {
  background: rgba(0, 0, 0, 0.15);
}
.play-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: ${C.gold};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
  box-shadow: 0 4px 15px rgba(201, 151, 44, 0.4);
}
.video-card:hover .play-circle {
  transform: scale(1.1);
}

        .app {
          background: ${C.bg};
          min-height: 100vh;
          color: ${C.ivory};
          font-family: 'Karla', sans-serif;
        }
        .display { font-family: 'Cinzel', serif; }

        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          45% { opacity: 0.85; transform: scaleY(0.94) translateY(0.5px); }
          70% { opacity: 1; transform: scaleY(1.05); }
        }
        .diya-flicker { animation: flicker 1.8s ease-in-out infinite; transform-origin: center bottom; }
        .diya-btn { background: none; border: none; padding: 0; cursor: pointer; transition: transform 0.15s; }
        .diya-btn:hover { transform: scale(1.12); }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid ${C.line};
          flex-wrap: wrap;
          gap: 10px;
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        
        .logo {
          height: 45px;
          width: auto;
          border-radius: 4px;
          object-fit: contain;
        }
        
        .hero-logo {
          width: 120px;
          height: auto;
          max-height: 120px;
          object-fit: contain;
          margin-bottom: 12px;
          filter: drop-shadow(0 0 20px rgba(201, 151, 44, 0.15));
          transition: transform 0.3s ease;
        }
        .hero-logo:hover {
          transform: scale(1.05);
        }
        
        .wordmark { color: ${C.goldBright}; letter-spacing: 0.05em; font-size: 1rem; }
        .lang-btn {
          background: ${C.panelLight};
          border: 1px solid ${C.line};
          color: ${C.ivory};
          padding: 4px 10px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: 'Karla', sans-serif;
        }
        .lang-btn:hover { background: ${C.gold}; color: ${C.bg}; border-color: ${C.gold}; }
        
        .notif-btn {
          background: ${C.panelLight};
          border: 1px solid ${C.line};
          color: ${C.ivory};
          padding: 4px 10px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: 'Karla', sans-serif;
        }
        .notif-btn:hover { background: ${C.gold}; color: ${C.bg}; border-color: ${C.gold}; }
        .notif-btn.active { background: ${C.gold}; color: ${C.bg}; border-color: ${C.gold}; }

        .tabs { display: flex; gap: 4px; }
        .tab-btn {
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 2px;
          border: none;
          cursor: pointer;
          font-family: 'Karla', sans-serif;
          background: transparent;
          color: ${C.muted};
        }
        .tab-btn.active { background: ${C.gold}; color: ${C.bg}; }

        .hero { text-align: center; padding: 30px 20px 24px; }
        .om { font-size: 2.8rem; color: ${C.gold}; }
        .hero h1 { font-size: 1.3rem; color: ${C.ivory}; margin: 6px 0 2px; }
        .hero p { color: ${C.muted}; font-size: 0.85rem; margin: 0; }
        .diya-row { display: flex; justify-content: center; gap: 16px; margin-top: 20px; }
        .diya-hint { color: ${C.muted}; font-size: 0.7rem; margin-top: 8px; }

        .section {
          max-width: 880px;
          margin: 0 auto;
          padding: 0 20px 48px;
        }
        .section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }
        .section-title { font-size: 1rem; color: ${C.goldBright}; margin: 0; }
        .note { color: ${C.muted}; font-size: 0.65rem; }

        .video-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 40px;
        }
        .video-card {
          display: block;
          background: ${C.panel};
          border: 1px solid ${C.line};
          border-radius: 4px;
          overflow: hidden;
          text-decoration: none;
          transition: transform 0.15s;
        }
        .video-card:hover { transform: scale(1.02); }
        .video-thumb {
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, ${C.panelLight}, ${C.bg});
        }
        .play-circle {
          width: 36px; height: 36px; border-radius: 50%;
          background: ${C.gold};
          display: flex; align-items: center; justify-content: center;
        }
        .video-body { padding: 10px 12px; }
        .video-title { font-size: 0.8rem; font-weight: 700; color: ${C.ivory}; margin: 0; }
        .video-meta { display: flex; justify-content: space-between; margin-top: 6px; }
        .video-date { font-size: 0.65rem; color: ${C.muted}; }
        .video-tag { font-size: 0.6rem; color: ${C.gold}; }

        .blog-list { display: flex; flex-direction: column; gap: 10px; }
        .blog-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px;
          background: ${C.panel};
          border: 1px solid ${C.line};
          border-radius: 4px;
          text-decoration: none;
          transition: transform 0.15s;
        }
        .blog-card:hover { transform: scale(1.01); }
        .blog-icon { color: ${C.gold}; margin-top: 2px; flex-shrink: 0; }
        .blog-text { flex: 1; }
        .blog-title { font-size: 0.9rem; font-weight: 700; color: ${C.ivory}; margin: 0; }
        .blog-snippet { font-size: 0.75rem; color: ${C.muted}; margin: 4px 0 0; }
        .blog-arrow { color: ${C.muted}; margin-top: 2px; flex-shrink: 0; }

        .fest-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
          margin-bottom: 48px;
          margin-top: 8px;
        }
        .fest-card {
          padding: 20px 22px;
          background: ${C.panelLight};
          border: 1px solid ${C.line};
          border-radius: 6px;
          text-decoration: none;
          display: block;
          transition: transform 0.15s, box-shadow 0.15s;
          min-height: 120px;
        }
        .fest-card:hover { 
          transform: scale(1.02); 
          box-shadow: 0 4px 20px rgba(201, 151, 44, 0.1);
        }
        .fest-title { 
          font-size: 1rem; 
          font-weight: 700; 
          color: ${C.goldBright}; 
          margin: 0 0 8px 0; 
          font-family: 'Cinzel', serif;
        }
        .fest-snippet { 
          font-size: 0.8rem; 
          color: ${C.muted}; 
          margin: 0; 
          line-height: 1.6; 
        }

        .event-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
        .event-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          background: ${C.panel};
          border: 1px solid ${C.line};
          border-radius: 4px;
          flex-wrap: wrap;
        }
        .event-date { width: 44px; text-align: center; flex-shrink: 0; }
        .event-day { display: block; font-size: 1.2rem; color: ${C.gold}; line-height: 1; }
        .event-mon { font-size: 0.6rem; color: ${C.muted}; letter-spacing: 0.1em; }
        .event-info { flex: 1; min-width: 140px; }
        .event-title { font-size: 0.9rem; font-weight: 700; color: ${C.ivory}; margin: 0; }
        .event-sub { display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
        .event-sub span { display: flex; align-items: center; gap: 3px; font-size: 0.7rem; color: ${C.muted}; }
        .bell-btn { background: none; border: none; cursor: pointer; padding: 4px; }
        .rsvp-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 6px 12px; font-size: 0.7rem; font-weight: 700;
          border-radius: 2px; border: 1px solid ${C.gold};
          background: transparent; color: ${C.gold};
          cursor: pointer; font-family: 'Karla', sans-serif;
        }
        .rsvp-btn.going { background: ${C.gold}; color: ${C.bg}; }

        .summary {
          text-align: center; padding: 14px;
          background: ${C.panelLight};
          border: 1px solid ${C.line};
          border-radius: 4px;
        }
        .summary p { margin: 0; color: ${C.muted}; font-size: 0.8rem; }
        .summary b { color: ${C.goldBright}; }

        .contact-section {
          max-width: 880px;
          margin: 0 auto;
          padding: 40px 20px 30px;
          border-top: 1px solid ${C.line};
        }
        .contact-title {
          font-size: 1.2rem;
          color: ${C.goldBright};
          text-align: center;
          margin-bottom: 8px;
        }
        .contact-sub {
          text-align: center;
          color: ${C.muted};
          font-size: 0.9rem;
          margin-bottom: 24px;
        }
        .contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .contact-card {
          background: ${C.panel};
          border: 1px solid ${C.line};
          border-radius: 6px;
          padding: 18px 20px;
          text-align: center;
          transition: transform 0.15s, box-shadow 0.15s;
          text-decoration: none;
          color: ${C.ivory};
        }
        .contact-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(201, 151, 44, 0.08);
          border-color: ${C.gold};
        }
        .contact-card .icon {
          color: ${C.gold};
          margin-bottom: 8px;
          display: inline-block;
        }
        .contact-card .label {
          font-size: 0.8rem;
          color: ${C.muted};
          margin-bottom: 4px;
        }
        .contact-card .value {
          font-size: 0.85rem;
          font-weight: 600;
          color: ${C.ivory};
          word-break: break-word;
        }
        .contact-card .value a {
          color: ${C.goldBright};
          text-decoration: none;
        }
        .contact-card .value a:hover {
          text-decoration: underline;
        }
        .contact-emails {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .social-icons {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .social-link {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${C.muted};
          text-decoration: none;
          font-size: 0.8rem;
          padding: 6px 14px;
          border: 1px solid ${C.line};
          border-radius: 4px;
          transition: all 0.15s;
        }
        .social-link:hover {
          color: ${C.goldBright};
          border-color: ${C.gold};
          background: ${C.panelLight};
        }
        .social-link .social-icon {
          color: ${C.gold};
        }

        .footer { text-align: center; padding: 20px; border-top: 1px solid ${C.line}; }
        .footer p { color: ${C.muted}; font-size: 0.7rem; margin: 0; }

        .toast {
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: ${C.gold}; color: ${C.bg}; font-weight: 600; font-size: 0.8rem;
          padding: 8px 16px; border-radius: 3px; z-index: 1000;
          max-width: 90%; text-align: center;
        }
        .header-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

        @media (max-width: 600px) {
          .header { flex-direction: column; align-items: stretch; }
          .header-left { justify-content: center; }
          .header-actions { justify-content: center; flex-wrap: wrap; }
          .fest-grid { grid-template-columns: 1fr; gap: 16px; }
          .fest-card { min-height: auto; }
          .video-grid { grid-template-columns: 1fr; }
          .contact-grid { grid-template-columns: 1fr; }
          .social-icons { flex-direction: column; align-items: center; }
          .hero-logo { width: 80px; max-height: 80px; }
        }
      `}</style>

      <div className="header">
        <div className="header-left">
          <img src="/Omkar Logo Final Transparent.png" alt="Omkar Samithi" className="logo" />
          <div className="wordmark display">{t.appName}</div>
        </div>
        <div className="header-actions">
          <button className="lang-btn" onClick={toggleLanguage} title={t.toggleLanguage}>
            <Globe size={14} /> {lang === "en" ? "ಕನ್ನಡ" : "English"}
          </button>
          <button 
            className={`notif-btn ${notificationsEnabled ? "active" : ""}`}
            onClick={requestNotificationPermission}
            title={t.enableNotifications}
          >
            {notificationsEnabled ? <BellRing size={14} /> : <BellOff size={14} />}
            {notificationsEnabled ? "🔔" : "🔕"}
          </button>
          <div className="tabs">
            <button className={`tab-btn ${tab === "hub" ? "active" : ""}`} onClick={() => setTab("hub")}>
              {t.contentHub}
            </button>
            <button className={`tab-btn ${tab === "events" ? "active" : ""}`} onClick={() => setTab("events")}>
              {t.events}
            </button>
          </div>
        </div>
      </div>

      <div className="hero">
        <img src="/Omkar Logo Final Transparent.png" alt="Omkar Samithi" className="hero-logo" />
        <h1 className="display">Oman Karnataka Aradhana Samithi</h1>
        <p>{t.tagline}</p>
        <div className="diya-row">
          {events.slice(0, 4).map((e, i) => (
            <Diya key={e.id} lit={i === 0} onClick={() => setTab("events")} label={e.title} />
          ))}
        </div>
        <p className="diya-hint">{t.diyaHint}</p>
      </div>

      {tab === "hub" && (
        <div className="section">
          <div className="section-head">
            <h2 className="section-title display">{t.programsRecordings}</h2>
            <span className="note">{t.sampleLayout}</span>
          </div>
          <div className="video-grid">
  {videos.map((v) => (
    <a 
      key={v.id} 
      href={v.url} 
      target="_blank" 
      rel="noreferrer" 
      className="video-card"
    >
      <div 
        className="video-thumb" 
        style={{ 
          backgroundImage: `url(${v.thumbnail})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          position: 'relative'
        }}
      >
        <div className="play-overlay">
          <div className="play-circle">
            <Play size={20} color={C.bg} fill={C.bg} />
          </div>
        </div>
      </div>
      <div className="video-body">
        <p className="video-title">{v.title}</p>
        <div className="video-meta">
          <span className="video-date">{v.date}</span>
          <span className="video-tag">{v.tag}</span>
        </div>
      </div>
    </a>
  ))}
</div>

          <h2 className="section-title display" style={{ marginBottom: 14 }}>{t.fromBlog}</h2>
          <div className="blog-list">
            {blogPosts.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="blog-card">
                <BookOpen size={16} className="blog-icon" />
                <div className="blog-text">
                  <p className="blog-title">{p.title}</p>
                  <p className="blog-snippet">{p.snippet}</p>
                </div>
                <ExternalLink size={12} className="blog-arrow" />
              </a>
            ))}
          </div>

          <h2 className="section-title display" style={{ marginBottom: 14, marginTop: 32 }}>{t.festivalNotes}</h2>
          <div className="fest-grid">
            {festivalPosts.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="fest-card">
                <p className="fest-title">{f.title}</p>
                <p className="fest-snippet">{f.snippet}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="section" style={{ maxWidth: 720 }}>
          <div className="section-head">
            <h2 className="section-title display">{t.upcomingPrograms}</h2>
            <span className="note">{t.sampleDates}</span>
          </div>

          <div className="event-list">
            {events.map((e) => (
              <div key={e.id} className="event-row">
                <div className="event-date">
                  <span className="event-day display">{e.day}</span>
                  <span className="event-mon">{e.mon}</span>
                </div>
                <div className="event-info">
                  <p className="event-title">{e.title}</p>
                  <div className="event-sub">
                    <span><User size={12} /> {e.guest}</span>
                    <span><MapPin size={12} /> {e.venue}</span>
                  </div>
                </div>
                <button className="bell-btn" onClick={() => toggleNotify(e.id, e.title)} title={t.remindersOn}>
                  {notify[e.id] ? <BellRing size={18} color={C.goldBright} /> : <Bell size={18} color={C.muted} />}
                </button>
                <button
                  className={`rsvp-btn ${rsvps[e.id] ? "going" : ""}`}
                  onClick={() => toggleRsvp(e.id, e.title)}
                >
                  {rsvps[e.id] ? (<><Check size={12} /> {t.going}</>) : t.rsvp}
                </button>
              </div>
            ))}
          </div>

          <div className="summary">
            <p>{t.rsvpCount} <b>{rsvpCount}</b> {rsvpCount === 1 ? t.program : t.programs}</p>
          </div>
        </div>
      )}

      <div className="contact-section">
        <h2 className="contact-title display">{t.contactUs}</h2>
        <p className="contact-sub">{t.contactMethods}</p>
        
        <div className="contact-grid">
          <div className="contact-card">
            <Mail size={28} className="icon" />
            <div className="label">{t.emailUs}</div>
            <div className="contact-emails">
              <span className="value">
                <a href="mailto:info@omkarsamithi.com">info@omkarsamithi.com</a>
              </span>
              <span className="value">
                <a href="mailto:omkarsamithi@gmail.com">omkarsamithi@gmail.com</a>
              </span>
            </div>
          </div>

          <a href="https://omkarfeedback.blogspot.com/" target="_blank" rel="noreferrer" className="contact-card">
            <Send size={28} className="icon" />
            <div className="label">{t.feedbackForm}</div>
            <div className="value">omkarfeedback.blogspot.com</div>
          </a>
        </div>

        <div className="social-icons">
          <a href="https://www.facebook.com/groups/omkarsamithi/" target="_blank" rel="noreferrer" className="social-link">
            <Facebook size={18} className="social-icon" />
            Facebook Group
          </a>
          <a href="https://www.youtube.com/@OmkarSamithi" target="_blank" rel="noreferrer" className="social-link">
            <Youtube size={18} className="social-icon" />
            YouTube Channel
          </a>
          <a href="https://omkarfeedback.blogspot.com/" target="_blank" rel="noreferrer" className="social-link">
            <ExternalLink size={18} className="social-icon" />
            Feedback Form
          </a>
        </div>
      </div>

      <div className="footer">
        <p>{t.pranaams}</p>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}