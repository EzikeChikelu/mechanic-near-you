import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type Role = 'customer' | 'mechanic';
const SERVICES = ['Engine repair', 'Auto electrical', 'Tyre repair', 'Diagnostics', 'Brake repair', 'AC repair', 'Battery service', 'Towing'];

export default function ProfileSetupScreen({ userId, role, onClose }: { userId: string; role: Role; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stateName, setStateName] = useState('');
  const [city, setCity] = useState('');
  const [business, setBusiness] = useState('');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState('0');
  const [radius, setRadius] = useState('15');
  const [services, setServices] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: p }, { data: m }, { data: s }] = await Promise.all([
        supabase.from('profiles').select('full_name,phone,state,city').eq('id', userId).maybeSingle(),
        role === 'mechanic' ? supabase.from('mechanic_profiles').select('business_name,bio,years_experience,service_radius_km').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null }),
        role === 'mechanic' ? supabase.from('mechanic_services').select('service_name').eq('mechanic_id', userId) : Promise.resolve({ data: [] }),
      ]);
      if (!active) return;
      setName(p?.full_name ?? '');
      setPhone(p?.phone ?? '');
      setStateName(p?.state ?? '');
      setCity(p?.city ?? '');
      setBusiness(m?.business_name ?? '');
      setBio(m?.bio ?? '');
      setYears(String(m?.years_experience ?? 0));
      setRadius(String(m?.service_radius_km ?? 15));
      setServices((s ?? []).map((x: { service_name: string }) => x.service_name));
      setLoading(false);
    })().catch((e) => {
      if (active) { setLoading(false); Alert.alert('Could not load profile', e.message ?? 'Please try again.'); }
    });
    return () => { active = false; };
  }, [userId, role]);

  const toggleService = (service: string) => setServices(current => current.includes(service) ? current.filter(x => x !== service) : [...current, service]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Enter your full name.');
    if (role === 'mechanic' && !phone.trim()) return Alert.alert('Phone required', 'Add a phone number customers can call.');
    if (role === 'mechanic' && !stateName.trim()) return Alert.alert('State required', 'Enter the state where you provide service.');
    if (role === 'mechanic' && !city.trim()) return Alert.alert('Area required', 'Enter your city or service area.');
    if (role === 'mechanic' && services.length === 0) return Alert.alert('Select a service', 'Choose at least one service you provide.');
    const exp = Math.max(0, Math.min(60, Number.parseInt(years, 10) || 0));
    const km = Math.max(1, Math.min(100, Number.parseInt(radius, 10) || 15));
    setSaving(true);
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: name.trim(), phone: phone.trim() || null,
        state: stateName.trim() || null, city: city.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
      if (profileError) throw profileError;
      if (role === 'mechanic') {
        const { error: mechanicError } = await supabase.from('mechanic_profiles').upsert({
          user_id: userId, business_name: business.trim() || null, bio: bio.trim() || null,
          years_experience: exp, service_radius_km: km,
          // In this app, "verified" means the mechanic completed the required
          // profile fields and can be listed. It is not identity/document verification.
          verification_status: 'verified',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (mechanicError) throw mechanicError;
        const { error: deleteError } = await supabase.from('mechanic_services').delete().eq('mechanic_id', userId);
        if (deleteError) throw deleteError;
        const { error: insertError } = await supabase.from('mechanic_services').insert(services.map(service_name => ({ mechanic_id: userId, service_name })));
        if (insertError) throw insertError;
      }
      Alert.alert('Profile saved', role === 'mechanic'
        ? 'Your mechanic profile is complete and can now appear in nearby searches when you are online.'
        : 'Your details have been updated.');
      onClose();
    } catch (e) {
      Alert.alert('Could not save profile', e instanceof Error ? e.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.back}><Ionicons name="arrow-back" size={21} color="#F0F4EE" /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.title}>Your profile</Text><Text style={styles.subtitle}>{role === 'mechanic' ? 'Help customers know and trust your service.' : 'Keep your contact and location details current.'}</Text></View>
      </View>
      {loading ? <ActivityIndicator color="#C7F36B" style={{ marginTop: 50 }} /> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>PERSONAL DETAILS</Text>
        <Text style={styles.label}>FULL NAME</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor="#78857C" style={styles.input} />
        <Text style={styles.label}>PHONE NUMBER {role === 'mechanic' ? '(REQUIRED)' : ''}</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="+234..." placeholderTextColor="#78857C" keyboardType="phone-pad" style={styles.input} />
        <Text style={styles.label}>STATE</Text>
        <TextInput value={stateName} onChangeText={setStateName} placeholder="e.g. Lagos" placeholderTextColor="#78857C" style={styles.input} />
        <Text style={styles.label}>CITY / AREA</Text>
        <TextInput value={city} onChangeText={setCity} placeholder="e.g. Yaba" placeholderTextColor="#78857C" style={styles.input} />
        {role === 'mechanic' && <>
          <Text style={styles.section}>MECHANIC BUSINESS</Text>
          <Text style={styles.label}>BUSINESS / WORKSHOP NAME</Text>
          <TextInput value={business} onChangeText={setBusiness} placeholder="Your workshop name (optional)" placeholderTextColor="#78857C" style={styles.input} />
          <Text style={styles.label}>ABOUT YOUR EXPERIENCE</Text>
          <TextInput value={bio} onChangeText={setBio} placeholder="Describe your experience and services" placeholderTextColor="#78857C" style={[styles.input, styles.multiline]} multiline />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Text style={styles.label}>YEARS OF EXPERIENCE</Text><TextInput value={years} onChangeText={setYears} keyboardType="number-pad" style={styles.input} placeholder="0" placeholderTextColor="#78857C" /></View>
            <View style={{ flex: 1 }}><Text style={styles.label}>SERVICE RADIUS (KM)</Text><TextInput value={radius} onChangeText={setRadius} keyboardType="number-pad" style={styles.input} placeholder="15" placeholderTextColor="#78857C" /></View>
          </View>
          <Text style={styles.section}>YOUR SPECIALTIES</Text>
          <Text style={styles.hint}>Select at least one service you provide.</Text>
          <View style={styles.services}>{SERVICES.map(item => {
            const selected = services.includes(item);
            return <TouchableOpacity key={item} onPress={() => toggleService(item)} style={[styles.service, selected && styles.serviceSelected]}>
              <Ionicons name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={selected ? '#C7F36B' : '#93A096'} />
              <Text style={[styles.serviceText, selected && { color: '#C7F36B' }]}>{item}</Text>
            </TouchableOpacity>;
          })}</View>
          <Text style={styles.notice}>Completing your name, phone, state, service area and at least one specialty enables your mechanic profile to appear in search. This is profile-completion status, not identity or document verification.</Text>
        </>}
        <TouchableOpacity disabled={saving} onPress={save} style={[styles.save, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#0A1110" /> : <><Text style={styles.saveText}>SAVE PROFILE</Text><Ionicons name="checkmark" size={18} color="#0A1110" /></>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            if (role === 'mechanic') {
              const { error: offlineError } = await supabase.from('mechanic_profiles')
                .update({ is_online: false, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
              if (offlineError) {
                Alert.alert('Could not sign out safely', offlineError.message);
                return;
              }
              const { error: locationError } = await supabase.from('mechanic_locations')
                .delete().eq('mechanic_id', userId);
              if (locationError) {
                Alert.alert('Could not clear shared location', locationError.message);
                return;
              }
            }
            const { error } = await supabase.auth.signOut();
            if (error) Alert.alert('Could not sign out', error.message);
            else onClose();
          }}
          style={styles.signOut}
        >
          <Ionicons name="log-out-outline" size={17} color="#F0A39B" />
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A1110' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: '#253129' },
  back: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#18231C', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F0F4EE', fontSize: 21, fontWeight: '900' },
  subtitle: { color: '#91A096', fontSize: 10, marginTop: 4 },
  content: { padding: 20, paddingBottom: 50 },
  section: { color: '#C7F36B', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 23, marginBottom: 7 },
  label: { color: '#A4B092', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 15, marginBottom: 7 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#141E19', paddingHorizontal: 13, color: '#F0F4EE', fontSize: 12 },
  multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  hint: { color: '#89968D', fontSize: 10, marginBottom: 12 },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  service: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#141E19', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 9 },
  serviceSelected: { borderColor: '#6C8C43', backgroundColor: '#1B2B1B' },
  serviceText: { color: '#AAB6AC', fontSize: 10, fontWeight: '700' },
  notice: { color: '#9C9A76', fontSize: 10, lineHeight: 16, marginTop: 18 },
  save: { height: 51, borderRadius: 13, backgroundColor: '#C7F36B', marginTop: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#0A1110', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  signOut: { height: 48, borderRadius: 13, borderWidth: 1, borderColor: '#5A3430', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { color: '#F0A39B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
