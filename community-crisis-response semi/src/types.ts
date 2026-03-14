export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'citizen' | 'volunteer' | 'admin';
  latitude: number;
  longitude: number;
  createdAt: string;
  phone?: string;
  age?: string;
  gender?: string;
  skills?: string[];
  experience?: string;
}

export interface Volunteer {
  userId: string;
  skills: string[];
  availability: boolean;
  rating: number;
}

export interface CrisisReport {
  id: string;
  userId: string;
  reporterName: string;
  crisisType: string;
  description: string;
  latitude: number;
  longitude: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'responding' | 'resolved';
  responderId?: string;
  createdAt: any;
}
