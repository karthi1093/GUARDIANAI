import React, { useState, useEffect, useRef, Component } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import { 
  AlertCircle, 
  MapPin, 
  Shield, 
  User as UserIcon, 
  Phone, 
  Activity, 
  Bell, 
  CheckCircle2, 
  XCircle,
  Mic,
  MicOff,
  Volume2,
  Navigation,
  LogOut,
  Sun,
  Moon,
  AlertTriangle,
  Edit,
  Save,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, CrisisReport, Volunteer } from './types';
import { GoogleGenAI, Type } from "@google/genai";
import { auth, db } from './firebase';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWeather } from './services/weatherService';

// Fix for default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  addDoc,
  updateDoc,
  serverTimestamp,
  where
} from 'firebase/firestore';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  state: { hasError: boolean, error: any };
  props: { children: React.ReactNode };

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
          message = "You don't have permission to perform this action. Please make sure you are logged in with the correct account.";
        }
      } catch (e) {
        // Not a JSON error
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
          <Card className="max-w-md w-full text-center">
            <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-brand-text mb-2">Application Error</h2>
            <p className="text-brand-text/70 mb-6">{message}</p>
            <Button onClick={() => window.location.reload()}>Reload Application</Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon }: any) => {
  const variants: any = {
    primary: 'bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-lg glow-primary border-none',
    secondary: 'bg-brand-text/10 hover:bg-brand-text/20 text-brand-text border border-brand-text/10 backdrop-blur-md',
    outline: 'bg-transparent border-2 border-brand-primary text-brand-primary hover:bg-brand-primary/10',
    ghost: 'bg-transparent hover:bg-brand-text/5 text-brand-text/70',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={20} />}
      {children}
    </motion.button>
  );
};

const Card = ({ children, className = '', noPadding = false, variant = 'glass' }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`${variant === 'glass' ? 'glass' : 'matte'} rounded-[32px] overflow-hidden ${noPadding ? '' : 'p-6'} ${className}`}
  >
    {children}
  </motion.div>
);

const Badge = ({ children, color = 'zinc' }: any) => {
  const colors: any = {
    red: 'bg-red-500/20 text-red-400 border border-red-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    blue: 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30',
    amber: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    indigo: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
    zinc: 'bg-brand-text/10 text-brand-text/70 border border-brand-text/10',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colors[color]}`}>
      {children}
    </span>
  );
};

const ThemeToggle = ({ theme, toggleTheme }: any) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={toggleTheme}
    className="fixed top-6 right-6 z-50 p-3 rounded-2xl glass text-brand-text"
  >
    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
  </motion.button>
);

const SKILLS = [
  "Medical Assistance", "First Aid", "CPR", "Doctor", "Nurse", "Ambulance Driver",
  "Search and Rescue", "Swimming", "Boat Operation", "Fire Extinguisher Handling",
  "Fire Safety", "Tree Cutting", "Chainsaw Operation", "Heavy Lifting", "Debris Removal",
  "Electrical Repair", "Mechanical Repair", "Construction", "Crowd Management",
  "Traffic Control", "Cooking / Food Distribution", "Water Distribution",
  "Logistics Support", "Emergency Communication", "Radio Operation", "Drone Operation",
  "Navigation / GPS", "Child Care", "Elderly Care", "Psychological Support / Counseling",
  "Animal Rescue", "Translator / Language Support"
];

const VolunteerProfileSetup = ({ onComplete, user, theme, toggleTheme }: any) => {
  const [name, setName] = useState(user?.name || user?.displayName || '');
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState('Rather Not Say');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (selectedSkills.length === 0) {
      setError('Please select at least one skill');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onComplete({
        name,
        age,
        gender,
        skills: selectedSkills,
        description
      });
      setSuccess(true);
    } catch (err) {
      setError('Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-brand-text">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="matte p-10 rounded-[40px] shadow-2xl text-center max-w-sm"
        >
          <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 glow-secondary">
            <CheckCircle2 size={48} />
          </div>
          <h3 className="text-3xl font-black text-brand-text mb-3">You're In!</h3>
          <p className="text-brand-text/60 mb-8 leading-relaxed">Your volunteer profile is active. The network is stronger with you.</p>
          <Button onClick={() => window.location.reload()} className="w-full py-4 text-lg">Enter Dashboard</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col text-brand-text">
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      <div className="flex-1 overflow-y-auto p-6 pb-40">
        <div className="max-w-md mx-auto space-y-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-block px-4 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-brand-primary/20">
              Step 2: Profile
            </div>
            <h3 className="text-4xl font-black text-brand-text mb-2 tracking-tight">Volunteer Setup</h3>
            <p className="text-brand-text/40">Customize your responder profile.</p>
          </motion.div>

          <div className="space-y-8">
            <section className="space-y-4">
              <label className="block text-[10px] font-black text-brand-text/40 uppercase tracking-[0.2em] ml-2">Identity</label>
              <Card variant="matte" className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-brand-text/60 mb-3">Full Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full p-4 bg-brand-text/5 border border-brand-text/10 rounded-2xl focus:ring-2 focus:ring-brand-primary outline-none transition-all text-brand-text placeholder:text-brand-text/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text/60 mb-4">Age: <span className="text-brand-primary">{age}</span></label>
                  <div className="relative h-32 overflow-hidden bg-brand-text/5 rounded-2xl border border-brand-text/10">
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20">
                      <div className="h-10 bg-gradient-to-b from-brand-bg/80 to-transparent" />
                      <div className="h-10 bg-gradient-to-t from-brand-bg/80 to-transparent" />
                    </div>
                    <div className="absolute top-1/2 left-0 right-0 h-10 -translate-y-1/2 border-y border-brand-primary/30 bg-brand-primary/5 pointer-events-none z-10" />
                    <div 
                      className="h-full overflow-y-scroll snap-y snap-mandatory py-10 no-scrollbar relative z-0"
                      onScroll={(e: any) => {
                        const scrollTop = e.target.scrollTop;
                        const itemHeight = 40;
                        const index = Math.round(scrollTop / itemHeight);
                        const val = 18 + index;
                        if (val >= 18 && val <= 70) setAge(val);
                      }}
                    >
                      {Array.from({ length: 53 }, (_, i) => 18 + i).map((val) => (
                        <div key={val} className={`h-10 flex items-center justify-center snap-center text-lg font-black transition-colors ${age === val ? 'text-brand-primary' : 'text-brand-text/20'}`}>
                          {val}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text/60 mb-4">Gender</label>
                  <div className="flex gap-2">
                    {['Male', 'Female', 'Other'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className={`flex-1 py-3 rounded-xl font-black text-xs transition-all border ${gender === g ? 'bg-brand-primary border-brand-primary text-brand-bg glow-primary' : 'bg-brand-text/5 border-brand-text/10 text-brand-text/40 hover:border-brand-text/20'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </section>

            <section className="space-y-4">
              <label className="block text-[10px] font-black text-brand-text/40 uppercase tracking-[0.2em] ml-2">Capabilities</label>
              <Card variant="matte" className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-brand-text/60 mb-4">Select Your Skills</label>
                  <div className="flex flex-wrap gap-2">
                    {SKILLS.map((skill) => (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        key={skill}
                        onClick={() => handleSkillToggle(skill)}
                        className={`px-4 py-2 rounded-full text-[10px] font-black transition-all border ${selectedSkills.includes(skill) ? 'bg-brand-primary/20 border-brand-primary text-brand-primary glow-primary' : 'bg-brand-text/5 border-brand-text/10 text-brand-text/40 hover:border-brand-text/20'}`}
                      >
                        {skill}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text/60 mb-3">Experience (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                    placeholder="Certifications, previous response experience..."
                    className="w-full h-32 p-4 bg-brand-text/5 border border-brand-text/10 rounded-2xl focus:ring-2 focus:ring-brand-primary outline-none transition-all resize-none text-brand-text placeholder:text-brand-text/20"
                  />
                  <div className="text-right text-[10px] font-black text-brand-text/20 mt-2 tracking-widest">{description.length}/300</div>
                </div>
              </Card>
            </section>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-black"
              >
                <XCircle size={18} />
                {error}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-brand-bg/80 backdrop-blur-xl border-t border-brand-border z-50">
        <div className="max-w-md mx-auto">
          <Button 
            className="w-full py-5 text-lg uppercase tracking-widest" 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Complete Registration'}
          </Button>
        </div>
      </div>
    </div>
  );
};


const citizenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const volunteerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const WeatherWidget = ({ weather, loading, onAutoDetectLocation }: { weather: any, loading: boolean, onAutoDetectLocation: () => void }) => {
  useEffect(() => {
    if ((!weather || weather.isDefault) && !loading) {
      onAutoDetectLocation();
    }
  }, [weather, loading, onAutoDetectLocation]);

  if (loading) return <Card variant="matte" className="mb-4 border-brand-primary/20 p-4 text-center text-brand-text/40">Loading weather...</Card>;
  if (!weather) return (
    <Card variant="matte" className="mb-4 border-brand-primary/20 p-4">
      <p className="text-center text-brand-text/40 mb-2">Weather data unavailable</p>
      <button onClick={onAutoDetectLocation} className="w-full bg-brand-primary text-white px-2 py-1 rounded text-sm">Auto-detect Location</button>
    </Card>
  );
  return (
    <Card variant="matte" className="mb-4 border-brand-primary/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sun className="text-brand-accent" size={24} />
          <div>
            <h4 className="font-black text-sm uppercase tracking-widest text-brand-text/60">Weather</h4>
            <p className="text-brand-text text-xl font-black">{weather.temp}°C</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-brand-text/60 text-sm">{weather.condition}</p>
          <p className="text-brand-text/40 text-xs">Wind: {weather.wind} km/h</p>
          {weather.isDefault && (
            <p className="text-brand-text/40 text-[10px] mt-1">
              <MapPin size={10} className="inline mr-1" />
              Default
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

const MapComponent = ({ center, markers, route }: { center: [number, number], markers: any[], route?: [number, number][] }) => {
  const MapAutoCenter = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
  };

  return (
    <div className="h-[300px] w-full rounded-[32px] overflow-hidden border border-brand-border shadow-inner relative z-0">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapAutoCenter center={center} />
        {markers.map((m, i) => (
          <Marker key={i} position={m.position} icon={m.type === 'volunteer' ? volunteerIcon : citizenIcon}>
            <Popup>
              <div className="p-2">
                <p className="font-bold text-brand-bg">{m.label}</p>
                <p className="text-xs text-brand-bg/70">{m.type === 'volunteer' ? 'Volunteer' : 'Citizen'}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        {route && <Polyline positions={route} color="#00d2ff" weight={4} opacity={0.7} dashArray="10, 10" />}
        <div className="absolute top-2 right-2 z-[1000] bg-white p-2 rounded-lg shadow-md text-xs">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div> Citizen
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div> Volunteer
          </div>
        </div>
      </MapContainer>
    </div>
  );
};

const ProfileDashboard = ({ user, theme, toggleTheme, onUpdateUser }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [newPhone, setNewPhone] = useState(user?.phone || '');
  const [newAge, setNewAge] = useState(user?.age || '');
  const [newGender, setNewGender] = useState(user?.gender || '');
  const [newSkills, setNewSkills] = useState(user?.skills?.join(', ') || '');
  const [newExperience, setNewExperience] = useState(user?.experience || '');
  const [updating, setUpdating] = useState(false);

  const handleUpdateProfile = async () => {
    if (!newName.trim()) return;
    setUpdating(true);
    try {
      const data: any = { name: newName, phone: newPhone };
      if (user.role === 'volunteer') {
        data.age = newAge;
        data.gender = newGender;
        data.skills = newSkills.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
        data.experience = newExperience;
      }
      await onUpdateUser(data);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-3xl text-brand-text tracking-tight">Profile</h3>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-text/5 hover:bg-brand-text/10 rounded-xl text-brand-text/60 text-xs font-black uppercase tracking-widest transition-all"
          >
            <Edit size={14} />
            Edit Profile
          </button>
        )}
      </div>

      <Card variant="matte" className="p-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-accent rounded-3xl flex items-center justify-center text-white glow-primary">
            <UserIcon size={40} />
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-1 block">Full Name</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-brand-text/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text font-bold outline-none focus:ring-2 focus:ring-brand-primary w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-1 block">Phone Number</label>
                  <input 
                    type="tel" 
                    value={newPhone} 
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="bg-brand-text/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text font-bold outline-none focus:ring-2 focus:ring-brand-primary w-full"
                  />
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-2xl font-black text-brand-text tracking-tight">{user?.name}</h4>
                <p className="text-brand-text/40 text-sm font-bold">{user?.email}</p>
                {user?.phone && <p className="text-brand-text/60 text-xs font-bold mt-1">{user.phone}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-brand-text/5 rounded-2xl border border-brand-border">
            <p className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-1">Role</p>
            <p className="font-black text-brand-text capitalize">{user?.role}</p>
          </div>
          <div className="p-4 bg-brand-text/5 rounded-2xl border border-brand-border">
            <p className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-1">Status</p>
            <Badge color="emerald">Active</Badge>
          </div>
        </div>
      </Card>

      {user?.role === 'volunteer' && (
        <div className="space-y-4">
          <h4 className="font-black text-brand-text/40 uppercase tracking-[0.2em] text-[10px] ml-2">Volunteer Details</h4>
          <Card variant="matte" className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-1">Age</p>
                  {isEditing ? (
                    <input 
                      type="number" 
                      value={newAge} 
                      onChange={(e) => setNewAge(e.target.value)}
                      className="bg-brand-text/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text font-bold outline-none focus:ring-2 focus:ring-brand-primary w-full"
                    />
                  ) : (
                    <p className="font-black text-brand-text">{user?.age || 'Not set'}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-1">Gender</p>
                  {isEditing ? (
                    <select 
                      value={newGender} 
                      onChange={(e) => setNewGender(e.target.value)}
                      className="bg-brand-text/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text font-bold outline-none focus:ring-2 focus:ring-brand-primary w-full"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <p className="font-black text-brand-text">{user?.gender || 'Not set'}</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-2">Skills</p>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={newSkills} 
                    onChange={(e) => setNewSkills(e.target.value)}
                    placeholder="e.g. First Aid, CPR, Rescue"
                    className="bg-brand-text/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text font-bold outline-none focus:ring-2 focus:ring-brand-primary w-full"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user?.skills?.length > 0 ? user.skills.map((skill: string) => (
                      <Badge key={skill} color="indigo">{skill}</Badge>
                    )) : <p className="text-brand-text/20 text-xs italic">No skills listed</p>}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest mb-2">Experience</p>
                {isEditing ? (
                  <textarea 
                    value={newExperience} 
                    onChange={(e) => setNewExperience(e.target.value)}
                    rows={3}
                    className="bg-brand-text/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text font-bold outline-none focus:ring-2 focus:ring-brand-primary w-full resize-none"
                  />
                ) : (
                  <p className="text-sm text-brand-text/60 leading-relaxed">{user?.experience || 'No experience details provided'}</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {isEditing && (
        <div className="flex gap-4">
          <Button 
            variant="success" 
            className="flex-1 py-4" 
            onClick={handleUpdateProfile}
            disabled={updating}
          >
            {updating ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 py-4" 
            onClick={() => setIsEditing(false)}
            disabled={updating}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="font-black text-brand-text/40 uppercase tracking-[0.2em] text-[10px] ml-2">Preferences</h4>
        <Card variant="matte" className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-text/5 rounded-xl flex items-center justify-center text-brand-text/40">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <p className="font-black text-brand-text tracking-tight">Appearance</p>
              <p className="text-[10px] text-brand-text/40 font-black uppercase tracking-widest">{theme} Mode</p>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className="px-4 py-2 glass rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-brand-primary transition-colors"
          >
            Switch
          </button>
        </Card>
      </div>

      <div className="pt-4">
        <Button 
          variant="secondary" 
          className="w-full py-4 text-xs uppercase tracking-widest"
          onClick={() => signOut(auth)}
          icon={LogOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'citizen' | 'volunteer' | 'dashboard' | 'role-select' | 'volunteer-setup' | 'profile'>('login');
  const [loading, setLoading] = useState(true);
  const [sosActive, setSosActive] = useState(false);
  const [sosDescription, setSosDescription] = useState('');
  const [crises, setCrises] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const { t } = useTranslation();
  const [aiGuidance, setAiGuidance] = useState<string | null>(null);
  const [quickSosSent, setQuickSosSent] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeRoute, setActiveRoute] = useState<[number, number][] | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const addNotification = (message: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleAutoDetectLocation = async () => {
    setLoadingWeather(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      const { latitude, longitude } = position.coords;
      const weatherData = await fetchWeather(latitude, longitude);
      if (weatherData) {
        weatherData.isDefault = false;
        setWeather(weatherData);
      }
    } catch (err) {
      console.error("Error auto-detecting location:", err);
    } finally {
      setLoadingWeather(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const checkWeather = async () => {
      setLoadingWeather(true);
      const lat = user.latitude || 20.5937;
      const lng = user.longitude || 78.9629;
      const weatherData = await fetchWeather(lat, lng);
      if (weatherData) {
        weatherData.isDefault = !user.latitude || !user.longitude;
        setWeather(weatherData);
      }
      setLoadingWeather(false);
    };

    checkWeather();
    const interval = setInterval(checkWeather, 600000); // Check every 10 mins
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({ ...firebaseUser, ...userData });
            if (userData.role === 'volunteer' && !userData.skills) {
              setView('volunteer-setup');
            } else {
              setView(userData.role);
            }
          } else {
            setUser(firebaseUser);
            setView('role-select');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setView('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const crisesQuery = query(collection(db, 'crises'), orderBy('createdAt', 'desc'));
    const unsubCrises = onSnapshot(crisesQuery, (snapshot) => {
      setCrises(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'crises');
    });

    const volunteersQuery = query(collection(db, 'users'), where('role', '==', 'volunteer'));
    const unsubVolunteers = onSnapshot(volunteersQuery, (snapshot) => {
      setVolunteers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubCrises();
      unsubVolunteers();
    };
  }, [user]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('User closed the login popup.');
      } else {
        console.error(err);
      }
      setLoading(false);
    }
  };

  const handleRoleSelect = async (role: 'citizen' | 'volunteer') => {
    if (!user) return;
    setLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      const { latitude, longitude } = position.coords;

      const userData = {
        uid: user.uid,
        name: user.displayName || 'Anonymous',
        email: user.email,
        role,
        latitude,
        longitude,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid), userData);
      setUser({ ...user, ...userData });
    } catch (err) {
      console.error("Error getting location:", err);
      // Fallback to a default location in India if geolocation fails
      const userData = {
        uid: user.uid,
        name: user.displayName || 'Anonymous',
        email: user.email,
        role,
        latitude: 20.5937,
        longitude: 78.9629,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid), userData);
      setUser({ ...user, ...userData });
    } finally {
      setLoading(false);
    }
  };

  const handleVolunteerSetupComplete = async (data: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setUser({ ...user, ...data });
      // Success state is handled within the component
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdateUser = async (data: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setUser({ ...user, ...data });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleQuickSos = async () => {
    setLoading(true);
    let latitude = 37.7749;
    let longitude = -122.4194;

    try {
      const position: any = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch (err) {
      console.warn("Location fallback:", err);
    }

    try {
      await addDoc(collection(db, 'crises'), {
        userId: 'anonymous',
        reporterName: 'Emergency Quick SOS',
        crisisType: 'Critical Emergency',
        description: 'QUICK SOS TRIGGERED FROM LOGIN SCREEN - IMMEDIATE ASSISTANCE REQUIRED',
        latitude,
        longitude,
        priority: 'critical',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setQuickSosSent(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crises');
    } finally {
      setLoading(false);
    }
  };

  const triggerSos = async (manualDescription?: any) => {
    const finalDescription = (typeof manualDescription === 'string' ? manualDescription : null) || sosDescription || voiceTranscript;
    if (!finalDescription || finalDescription === "Listening for emergency...") return;
    setLoading(true);
    
    let latitude = user?.latitude || 37.7749;
    let longitude = user?.longitude || -122.4194;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch (err) {
      console.warn("Location fallback:", err);
    }

    try {
      // AI Classification
      const model = 'gemini-3-flash-preview';
      const prompt = `Classify this emergency: "${finalDescription}". Return JSON with crisis_type, required_skills (array), and priority (low, medium, high, critical).`;
      
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              crisis_type: { type: Type.STRING },
              required_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              priority: { type: Type.STRING }
            },
            required: ['crisis_type', 'required_skills', 'priority']
          }
        }
      });

      const classification = JSON.parse(response.text || '{}');

      await addDoc(collection(db, 'crises'), {
        userId: user.uid,
        reporterName: user.name,
        crisisType: classification.crisis_type,
        description: finalDescription,
        latitude,
        longitude,
        priority: classification.priority,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setSosActive(false);
      setSosDescription('');
      setVoiceTranscript('');
      setAiGuidance(`Emergency reported. AI classified as ${classification.priority} priority. Nearby volunteers notified.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crises');
    } finally {
      setLoading(false);
    }
  };

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  const toggleVoiceAssistant = () => {
    if (isVoiceActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsVoiceActive(false);
      setVoiceTranscript('');
      transcriptRef.current = '';
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsVoiceActive(true);
        setVoiceTranscript("Listening for emergency...");
        transcriptRef.current = '';
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setVoiceTranscript(currentText);
        transcriptRef.current = currentText;
      };

      recognition.onerror = (event: any) => {
        // Don't log 'no-speech' as a console error to reduce noise, as it's a common timeout
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error:", event.error);
        }
        
        setIsVoiceActive(false);
        
        if (event.error === 'no-speech') {
          setVoiceTranscript("No speech detected. Please try again.");
          // Clear the message after 3 seconds
          setTimeout(() => {
            setVoiceTranscript(prev => prev === "No speech detected. Please try again." ? "" : prev);
          }, 3000);
        } else if (event.error === 'audio-capture') {
          setVoiceTranscript("Microphone not found or in use.");
        } else if (event.error === 'not-allowed') {
          setVoiceTranscript("Microphone permission denied.");
        } else {
          setVoiceTranscript(`Error: ${event.error}`);
        }
        transcriptRef.current = '';
      };

      recognition.onend = async () => {
        setIsVoiceActive(false);
        const finalSpeech = transcriptRef.current;

        if (!finalSpeech || finalSpeech === "Listening for emergency..." || finalSpeech.length < 5) {
          return;
        }

        setVoiceTranscript("Analyzing for emergency...");

        try {
          const model = 'gemini-3-flash-preview';
          const prompt = `Analyze this transcript: "${finalSpeech}". Is this a genuine emergency report that requires immediate help? Answer only with "YES" or "NO". If it's general conversation, testing, or system prompts, answer "NO".`;
          
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
          });

          const isEmergency = response.text?.trim().toUpperCase().includes('YES');

          if (isEmergency) {
            setVoiceTranscript(`Emergency detected: "${finalSpeech}". Triggering SOS...`);
            setTimeout(() => {
              triggerSos(finalSpeech);
            }, 1500);
          } else {
            setVoiceTranscript("No emergency detected in speech.");
            setTimeout(() => setVoiceTranscript(''), 3000);
          }
        } catch (err) {
          console.error("AI verification failed:", err);
          setVoiceTranscript("Could not verify emergency. Please use the SOS button manually if needed.");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const respondToCrisis = async (crisisId: string, status: 'responding' | 'resolved') => {
    try {
      const updateData: any = { status };
      if (status === 'responding') {
        updateData.responderId = user.uid;
      }
      await updateDoc(doc(db, 'crises', crisisId), updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `crises/${crisisId}`);
    }
  };

  useEffect(() => {
    if (user?.role === 'volunteer' && crises.some(c => c.responderId === user.uid && c.status === 'responding')) {
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            });
          } catch (err) {
            console.error("Failed to update location", err);
          }
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user, crises]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-text font-bold tracking-widest uppercase text-xs">Initializing CrisisGrid...</p>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-brand-bg text-brand-text">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary/20 blur-[120px] rounded-full" />
        </div>
        
        <div className="w-full max-w-md relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-10 rounded-[48px] shadow-2xl text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-accent rounded-3xl flex items-center justify-center mx-auto mb-8 glow-primary">
              <Shield className="text-white" size={40} />
            </div>
            <h3 className="text-4xl font-black text-brand-text mb-3 tracking-tight">GuardianAI</h3>
            <p className="text-brand-text/40 mb-10 leading-relaxed">The next generation of emergency response coordination.</p>
            
            <div className="space-y-4">
              <Button onClick={handleGoogleLogin} className="w-full py-5 text-lg uppercase tracking-widest" icon={Shield}>
                Secure Login
              </Button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-brand-text/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-brand-bg px-4 text-brand-text/20 font-black tracking-widest">Emergency Only</span>
                </div>
              </div>

              {quickSosSent ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl"
                >
                  <CheckCircle2 className="text-emerald-400 mx-auto mb-3" size={32} />
                  <p className="text-emerald-400 font-black text-sm uppercase tracking-widest">SOS Sent Successfully</p>
                  <p className="text-brand-text/40 text-[10px] mt-2 leading-relaxed">Responders are on their way to your location.</p>
                </motion.div>
              ) : (
                <Button 
                  onClick={handleQuickSos} 
                  variant="secondary" 
                  className="w-full py-5 text-lg uppercase tracking-widest border-red-500/30 text-red-500 hover:bg-red-500/10" 
                  icon={AlertTriangle}
                >
                  Quick SOS
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  if (view === 'role-select') {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center p-6 relative bg-brand-bg text-brand-text">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <div className="w-full max-w-md relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <WeatherWidget weather={weather} loading={loadingWeather} onAutoDetectLocation={handleAutoDetectLocation} />
            <h3 className="text-4xl font-black text-brand-text mb-3 tracking-tight">{t('join_network')}</h3>
            <p className="text-brand-text/40">{t('select_role')}</p>
          </motion.div>
          
          <div className="grid grid-cols-1 gap-4">
            <motion.button 
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleRoleSelect('citizen')} 
              className="p-8 glass rounded-[32px] hover:border-brand-primary transition-all flex items-center gap-6 text-left group"
            >
              <div className="w-16 h-16 bg-brand-text/5 rounded-2xl flex items-center justify-center text-brand-text/40 group-hover:bg-brand-primary/20 group-hover:text-brand-primary transition-colors">
                <UserIcon size={32} />
              </div>
              <div>
                <span className="block font-black text-xl text-brand-text">{t('citizen')}</span>
                <span className="text-sm text-brand-text/40">{t('citizen_desc')}</span>
              </div>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleRoleSelect('volunteer')} 
              className="p-8 glass rounded-[32px] hover:border-brand-secondary transition-all flex items-center gap-6 text-left group"
            >
              <div className="w-16 h-16 bg-brand-text/5 rounded-2xl flex items-center justify-center text-brand-text/40 group-hover:bg-brand-secondary/20 group-hover:text-brand-secondary transition-colors">
                <Activity size={32} />
              </div>
              <div>
                <span className="block font-black text-xl text-brand-text">{t('volunteer')}</span>
                <span className="text-sm text-brand-text/40">{t('volunteer_desc')}</span>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  if (view === 'volunteer-setup') {
    return <VolunteerProfileSetup user={user} onComplete={handleVolunteerSetupComplete} theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen font-sans pb-32 bg-brand-bg text-brand-text">
      <header className="glass px-6 py-5 sticky top-0 z-50 flex items-center justify-between border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-accent rounded-xl flex items-center justify-center glow-primary">
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <h2 className="font-black text-brand-text tracking-tight leading-none">GuardianAI</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              <p className="text-[8px] text-brand-text/40 font-black uppercase tracking-[0.2em]">Live Network</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => signOut(auth)}
            className="w-10 h-10 glass rounded-xl flex items-center justify-center text-brand-text/40 hover:text-red-400 hover:border-red-400/30 transition-all"
          >
            <LogOut size={18} />
          </motion.button>
          <div className="w-10 h-10 rounded-xl glass p-0.5 overflow-hidden">
            <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} alt="avatar" className="w-full h-full rounded-[10px] object-cover" />
          </div>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-8">
        {notifications.length > 0 && (
          <div className="fixed top-20 left-6 right-6 z-[60] space-y-2">
            {notifications.map(n => (
              <motion.div 
                key={n.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-red-500/90 text-white p-4 rounded-2xl shadow-lg font-bold text-sm"
              >
                {n.message}
              </motion.div>
            ))}
          </div>
        )}
        {view === 'citizen' && (
          <>
            <WeatherWidget weather={weather} loading={loadingWeather} onAutoDetectLocation={handleAutoDetectLocation} />
            {crises.find(c => c.userId === user.uid && c.status === 'responding') && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-brand-primary uppercase tracking-[0.2em] text-[10px] ml-2">Help is on the way</h4>
                  <Badge color="emerald">Responder En Route</Badge>
                </div>
                {(() => {
                  const crisis = crises.find(c => c.userId === user.uid && c.status === 'responding');
                  const responder = volunteers.find(v => v.id === crisis.responderId);
                  if (!crisis || !responder) return null;
                  return (
                    <Card variant="matte" className="p-0 overflow-hidden border-brand-primary/30">
                      <MapComponent 
                        center={[crisis.latitude, crisis.longitude]} 
                        markers={[
                          { position: [crisis.latitude, crisis.longitude], label: 'Your Location', type: 'citizen' },
                          { position: [responder.latitude, responder.longitude], label: `${responder.name} (Responder)`, type: 'volunteer' }
                        ]}
                        route={[[responder.latitude, responder.longitude], [crisis.latitude, crisis.longitude]]}
                      />
                      <div className="p-6 flex items-center justify-between bg-brand-primary/5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 glass p-0.5 rounded-xl overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${responder.uid}`} alt="avatar" className="w-full h-full rounded-[10px]" />
                          </div>
                          <div>
                            <p className="font-black text-white tracking-tight">{responder.name}</p>
                            <p className="text-[10px] text-brand-text/40 font-black uppercase tracking-widest">Emergency Responder</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" className="px-4 py-2 text-[10px]" icon={Phone}>Contact</Button>
                          <Button 
                            variant="secondary" 
                            className="px-4 py-2 text-[10px]" 
                            icon={Navigation}
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${responder.latitude},${responder.longitude}`, '_blank')}
                          >
                            Navigate
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
              </motion.div>
            )}

            <Card variant="matte" className="relative overflow-hidden group border-brand-primary/20">
              <div className="relative z-10">
                <Badge color="red">Emergency Alert</Badge>
                <h3 className="text-brand-text font-black text-3xl mt-4 mb-2 tracking-tight">Need Help?</h3>
                <p className="text-brand-text/40 text-sm mb-8 max-w-[240px] leading-relaxed">Your location will be broadcast to the nearest qualified responders.</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{ 
                    boxShadow: ["0 0 0 0px rgba(0, 210, 255, 0.2)", "0 0 0 30px rgba(0, 210, 255, 0)"],
                  }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  onClick={() => setSosActive(true)}
                  className="w-40 h-40 bg-gradient-to-br from-brand-primary to-brand-accent rounded-full flex flex-col items-center justify-center text-white font-black shadow-2xl glow-primary border-8 border-brand-text/10"
                >
                  <AlertCircle size={48} className="mb-1" />
                  <span className="text-xl tracking-widest">SOS</span>
                </motion.button>
              </div>
              <div className="absolute right-[-40px] bottom-[-40px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Shield size={320} className="text-brand-text" />
              </div>
            </Card>

            <Card variant="matte" className="border-brand-secondary/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isVoiceActive ? 'bg-brand-primary animate-pulse' : 'bg-brand-text/20'}`} />
                  <h3 className="font-black text-sm uppercase tracking-widest text-brand-text/60">AI Intelligence</h3>
                </div>
                <button 
                  onClick={toggleVoiceAssistant} 
                  className={`p-4 rounded-2xl transition-all ${isVoiceActive ? 'bg-brand-primary text-brand-bg glow-primary' : 'bg-brand-text/5 text-brand-text/40 border border-brand-text/10'}`}
                >
                  {isVoiceActive ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              </div>
              <div className="p-4 bg-brand-text/5 rounded-2xl border border-brand-text/5">
                <p className="text-brand-text/40 text-sm italic font-medium">
                  {voiceTranscript || "Tap the mic to report an emergency via voice. Our AI will classify the crisis automatically."}
                </p>
              </div>
            </Card>

            {aiGuidance && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-emerald-500/10 border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-emerald-400 mt-1" size={20} />
                    <div>
                      <h4 className="font-black text-emerald-400 uppercase tracking-widest text-[10px]">AI Guidance</h4>
                      <p className="text-brand-text/70 text-sm mt-1 leading-relaxed">{aiGuidance}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            <div className="space-y-4">
              <h4 className="font-black text-brand-text/40 uppercase tracking-[0.2em] text-[10px] ml-2">Nearby Responders</h4>
              {volunteers.length === 0 ? (
                <p className="text-brand-text/20 text-sm italic ml-2">Scanning network for active volunteers...</p>
              ) : (
                <div className="space-y-4">
                  <Card variant="matte" className="p-0 overflow-hidden border-brand-secondary/20">
                    <MapComponent 
                      center={[user?.latitude || 37.7749, user?.longitude || -122.4194]} 
                      markers={[
                        ...(user ? [{ position: [user.latitude, user.longitude], label: 'You', type: 'citizen' }] : []),
                        ...volunteers.map(v => ({ position: [v.latitude, v.longitude], label: v.name, type: 'volunteer' }))
                      ]}
                    />
                  </Card>
                  <div className="grid grid-cols-1 gap-3">
                    {volunteers.map(v => (
                    <motion.div 
                      key={v.id} 
                      whileHover={{ x: 5 }}
                      className="flex items-center justify-between p-4 glass rounded-[24px]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 glass p-0.5 rounded-xl overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${v.uid}`} alt="avatar" className="w-full h-full rounded-[10px]" />
                        </div>
                        <div>
                          <p className="font-black text-white tracking-tight">{v.name}</p>
                          <Badge color="emerald">Active</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {v.skills?.slice(0, 2).map((s: string) => (
                          <div key={s} className="w-2 h-2 rounded-full bg-brand-primary/40" title={s} />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'volunteer' && (
          <>
            <WeatherWidget weather={weather} loading={loadingWeather} onAutoDetectLocation={handleAutoDetectLocation} />
            {crises.find(c => c.responderId === user.uid && c.status === 'responding') && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 mb-12">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-brand-primary uppercase tracking-[0.2em] text-[10px] ml-2">Active Mission</h4>
                  <Badge color="red">Emergency Response</Badge>
                </div>
                {(() => {
                  const crisis = crises.find(c => c.responderId === user.uid && c.status === 'responding');
                  if (!crisis) return null;
                  return (
                    <Card variant="matte" className="p-0 overflow-hidden border-brand-primary/30">
                      <MapComponent 
                        center={[user.latitude, user.longitude]} 
                        markers={[
                          { position: [user.latitude, user.longitude], label: 'You', type: 'volunteer' },
                          { position: [crisis.latitude, crisis.longitude], label: 'Emergency Location', type: 'citizen' }
                        ]}
                        route={[[user.latitude, user.longitude], [crisis.latitude, crisis.longitude]]}
                      />
                      <div className="p-6 bg-brand-primary/5">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-black text-xl text-brand-text tracking-tight">{crisis.crisisType}</h4>
                            <p className="text-xs text-brand-text/60 mt-1">{crisis.description}</p>
                          </div>
                          <Badge color="red">Critical</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Button variant="success" className="py-4" icon={CheckCircle2} onClick={() => respondToCrisis(crisis.id, 'resolved')}>Mark Resolved</Button>
                          <Button variant="secondary" className="py-4" icon={Navigation} onClick={() => window.open(`https://www.google.com/maps?q=${crisis.latitude},${crisis.longitude}`, '_blank')}>Navigate</Button>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
              </motion.div>
            )}

            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-3xl text-brand-text tracking-tight">Active Alerts</h3>
              <Badge color="emerald">Available</Badge>
            </div>
            <div className="space-y-6">
              {crises.filter(c => c.status === 'pending').length === 0 ? (
                <div className="text-center py-20 matte rounded-[40px]">
                  <Shield className="text-brand-text/10 mx-auto mb-6" size={64} />
                  <p className="text-brand-text/40 font-black uppercase tracking-widest text-xs">No active emergencies in your area.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Card variant="matte" className="p-0 overflow-hidden border-brand-primary/20">
                    <MapComponent 
                      center={[user?.latitude || 37.7749, user?.longitude || -122.4194]} 
                      markers={[
                        { position: [user.latitude, user.longitude], label: 'You', type: 'volunteer' },
                        ...crises.filter(c => c.status === 'pending').map(c => ({ position: [c.latitude, c.longitude], label: c.crisisType, type: 'citizen' }))
                      ]}
                      route={activeRoute || undefined}
                    />
                  </Card>
                  {crises.filter(c => c.status === 'pending').map(crisis => (
                    <Card key={crisis.id} variant="matte" className="border-l-4 border-l-brand-primary">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <Badge color={crisis.priority === 'critical' ? 'red' : 'amber'}>{crisis.priority}</Badge>
                          <h4 className="font-black text-2xl text-brand-text mt-3 tracking-tight capitalize">{crisis.crisisType}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-brand-text/20 uppercase tracking-widest">Reporter</p>
                          <p className="text-xs font-bold text-brand-text/60">{crisis.reporterName}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-brand-text/5 rounded-2xl mb-4 border border-brand-border">
                        <p className="text-brand-text/60 text-sm leading-relaxed italic">"{crisis.description}"</p>
                      </div>
                      <div className="flex items-center gap-2 mb-8 text-brand-text/40 text-[10px] font-black uppercase tracking-widest">
                        <MapPin size={14} className="text-brand-primary" />
                        <span>{crisis.latitude.toFixed(4)}, {crisis.longitude.toFixed(4)}</span>
                        <a 
                          href={`https://www.google.com/maps?q=${crisis.latitude},${crisis.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-auto text-brand-primary hover:underline"
                        >
                          Open Maps
                        </a>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Button variant="primary" className="py-4" icon={CheckCircle2} onClick={() => respondToCrisis(crisis.id, 'responding')}>Accept Call</Button>
                        <Button variant="secondary" className="py-4" icon={Navigation} onClick={() => setActiveRoute([[user.latitude, user.longitude], [crisis.latitude, crisis.longitude]])}>Show Path</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'dashboard' && (
          <div className="space-y-8">
            <h3 className="font-black text-3xl text-brand-text tracking-tight">Network Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card variant="matte" className="p-8 text-center border-brand-primary/20">
                <span className="block text-5xl font-black text-brand-primary mb-2 glow-primary">{crises.filter(c => c.status === 'pending').length}</span>
                <span className="text-[10px] font-black text-brand-text/40 uppercase tracking-[0.2em]">Active Alerts</span>
              </Card>
              <Card variant="matte" className="p-8 text-center border-brand-secondary/20">
                <span className="block text-5xl font-black text-brand-secondary mb-2 glow-secondary">{volunteers.length}</span>
                <span className="text-[10px] font-black text-brand-text/40 uppercase tracking-[0.2em]">Responders</span>
              </Card>
            </div>
            <div className="space-y-4">
              <h4 className="font-black text-brand-text/40 uppercase tracking-[0.2em] text-[10px] ml-2">Recent Incidents</h4>
              <div className="space-y-3">
                {crises.map(crisis => (
                  <motion.div 
                    key={crisis.id} 
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center justify-between p-5 matte rounded-[28px]"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${crisis.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-primary/20 text-brand-primary'}`}>
                        {crisis.status === 'resolved' ? <CheckCircle2 size={24} /> : <Activity size={24} />}
                      </div>
                      <div>
                        <p className="font-black text-brand-text tracking-tight">{crisis.crisisType}</p>
                        <p className="text-[10px] text-brand-text/40 font-black uppercase tracking-widest">{crisis.reporterName}</p>
                      </div>
                    </div>
                    <Badge color={crisis.status === 'resolved' ? 'emerald' : 'amber'}>{crisis.status}</Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'profile' && (
          <ProfileDashboard 
            user={user} 
            theme={theme} 
            toggleTheme={toggleTheme} 
            onUpdateUser={handleUpdateUser} 
          />
        )}
      </main>

      <AnimatePresence>
        {sosActive && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] bg-brand-bg/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }} 
              className="matte w-full max-w-md rounded-[48px] p-10 border-brand-primary/20 shadow-2xl"
            >
              <div className="w-16 h-16 bg-brand-primary/20 rounded-2xl flex items-center justify-center mb-6 text-brand-primary">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-3xl font-black text-brand-text mb-2 tracking-tight">Emergency SOS</h3>
              <p className="text-brand-text/40 mb-8 text-sm">Describe the situation briefly. Our AI will classify and route your request immediately.</p>
              
              <textarea
                value={sosDescription}
                onChange={(e) => setSosDescription(e.target.value)}
                placeholder="What's happening? (e.g., Fire in the kitchen, medical emergency...)"
                className="w-full h-40 p-6 bg-brand-text/5 border border-brand-text/10 rounded-[32px] mb-8 text-brand-text placeholder:text-brand-text/20 focus:ring-2 focus:ring-brand-primary outline-none transition-all resize-none leading-relaxed"
              />
              
              <div className="flex flex-col gap-4">
                <Button 
                  className="w-full py-5 text-lg uppercase tracking-widest glow-primary" 
                  onClick={() => triggerSos()} 
                  disabled={loading || !sosDescription}
                  icon={Shield}
                >
                  {loading ? 'Transmitting...' : 'Broadcast SOS'}
                </Button>
                <Button variant="secondary" className="w-full py-4 uppercase tracking-widest text-xs" onClick={() => setSosActive(false)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {user?.role === 'citizen' && view !== 'login' && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1, rotate: 5 }} 
          whileTap={{ scale: 0.9 }}
          onClick={() => setSosActive(true)}
          className="fixed bottom-28 right-6 z-[60] w-20 h-20 bg-brand-primary rounded-full flex items-center justify-center text-white shadow-2xl shadow-brand-primary/50 border-4 border-brand-bg glow-primary"
        >
          <AlertCircle size={36} />
        </motion.button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-brand-border px-10 py-6 flex justify-between items-center z-50">
        <button 
          onClick={() => setView(user?.role)} 
          className={`flex flex-col items-center gap-2 transition-all ${view === user?.role ? 'text-brand-primary scale-110' : 'text-brand-text/30 hover:text-brand-text/60'}`}
        >
          <Shield size={24} className={view === user?.role ? 'glow-primary' : ''} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Home</span>
        </button>
        <button 
          onClick={() => setView('dashboard')} 
          className={`flex flex-col items-center gap-2 transition-all ${view === 'dashboard' ? 'text-brand-secondary scale-110' : 'text-brand-text/30 hover:text-brand-text/60'}`}
        >
          <Activity size={24} className={view === 'dashboard' ? 'glow-secondary' : ''} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Status</span>
        </button>
        <button 
          onClick={() => setView('profile')} 
          className={`flex flex-col items-center gap-2 transition-all ${view === 'profile' ? 'text-brand-accent scale-110' : 'text-brand-text/30 hover:text-brand-text/60'}`}
        >
          <UserIcon size={24} className={view === 'profile' ? 'glow-accent' : ''} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Profile</span>
        </button>
        <button 
          onClick={() => signOut(auth)} 
          className="flex flex-col items-center gap-2 text-brand-text/30 hover:text-brand-accent transition-all hover:scale-110"
        >
          <LogOut size={24} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Exit</span>
        </button>
      </nav>
    </div>
    </ErrorBoundary>
  );
}
