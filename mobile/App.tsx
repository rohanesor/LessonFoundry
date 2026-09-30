import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";

const API = process.env.EXPO_PUBLIC_API_URL || "https://lessonfoundry.duckdns.org/api";
type Role = "teacher" | "student";
type Me = { name: string; role: Role; onboarding_completed?: boolean };
type Avatar = { id: string; name: string; description: string };
type Pack = { title: string; subject: string; level: string; video?: { title: string; url: string; is_demo: boolean } | null };

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, { ...init, headers: { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ detail: "Request failed" }))).detail || "Request failed");
  return r.json();
}

export default function App() {
  const [token, setToken] = useState(""); const [role, setRole] = useState<Role>("student"); const [me, setMe] = useState<Me | null>(null); const [error, setError] = useState(""); const [pack, setPack] = useState<Pack | null>(null); const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [email, setEmail] = useState("");
  useEffect(() => { if (!token) return; request<Me>("/me", token).then(setMe).catch(e => setError(e.message)); }, [token]);
  async function chooseAvatar() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 }); if (result.canceled || !me || !token) return; const asset = result.assets[0]; const form = new FormData(); form.append("file", { uri: asset.uri, name: "avatar.jpg", type: "image/jpeg" } as any); form.append("name", "Mobile avatar"); try { const a = await request<Avatar>("/avatars", token, { method: "POST", body: form }); setAvatars(x => [a, ...x]); } catch (e) { setError((e as Error).message); } }
  if (!me) return <SafeAreaView style={s.screen}><Text style={s.brand}>LessonFoundry</Text><Text style={s.title}>Learn with control.</Text><TextInput style={s.input} placeholder="Access token" secureTextEntry value={token} onChangeText={setToken}/><Text style={s.muted}>The mobile client uses the same authenticated API as the web app.</Text>{error ? <Text style={s.error}>{error}</Text> : null}</SafeAreaView>;
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}><Text style={s.brand}>LessonFoundry</Text><Text style={s.muted}>{me.name} · {me.role}</Text>{me.role === "teacher" ? <><Text style={s.title}>AI Teacher</Text><Text style={s.muted}>Choose a private avatar profile or manage approved videos from the web Studio.</Text><Button title="Choose avatar photo" onPress={chooseAvatar}/>{avatars.map(a => <View style={s.card} key={a.id}><Text style={s.heading}>{a.name}</Text><Text>{a.description}</Text></View>)}</> : <><Text style={s.title}>Continue learning</Text><Text style={s.muted}>Open an authenticated classroom pack to watch its published lesson.</Text>{pack?.video ? <View style={s.card}><Text style={s.heading}>{pack.video.title}</Text><Video source={{ uri: pack.video.url }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={s.video}/>{pack.video.is_demo && <Text style={s.muted}>Development demo video</Text>}</View> : <Text style={s.muted}>No published video selected.</Text>}</>}</ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#f3f2f2" }, content: { padding: 24, gap: 16 }, brand: { fontSize: 20, fontWeight: "800", color: "#1d2433" }, title: { fontSize: 32, fontWeight: "800", color: "#1d2433", marginTop: 24 }, heading: { fontSize: 18, fontWeight: "700", color: "#1d2433" }, muted: { color: "#605d5d", lineHeight: 22 }, input: { borderWidth: 1, borderColor: "#7d7979", padding: 12, backgroundColor: "#fafaf9" }, card: { borderWidth: 1, borderColor: "#d7d3d3", padding: 16, gap: 8, backgroundColor: "#fafaf9" }, video: { width: "100%", height: 220 }, error: { color: "#9b1f1d" } });
