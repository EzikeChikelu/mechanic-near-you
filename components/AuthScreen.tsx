import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type Role = 'customer' | 'mechanic';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [role, setRole] = useState<Role>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert('Missing details', 'Enter your email address and password.');
    if (mode === 'signup' && !name.trim()) return Alert.alert('Your name is required', 'Please enter your full name.');
    if (password.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim(), phone: phone.trim() || null, role } },
        });
        if (error) throw error;
        if (!data.session) Alert.alert('Check your email', 'Confirm your email, then return here and sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      }
    } catch (error) {
      Alert.alert(mode === 'signup' ? 'Could not create account' : 'Could not sign in', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}><Ionicons name="construct" size={25} color="#0A1110" /></View>
          <Text style={styles.brand}>MECHANIC <Text style={styles.accent}>NEAR YOU</Text></Text>
          <Text style={styles.kicker}>ROADSIDE HELP, RIGHT AROUND YOU</Text>
          <Text style={styles.title}>{mode === 'signup' ? 'Get moving.' : 'Welcome back.'}</Text>
          <Text style={styles.subtitle}>{mode === 'signup' ? 'Create an account to connect with trusted roadside professionals.' : 'Sign in to continue to your account.'}</Text>
          {mode === 'signup' && <>
            <Text style={styles.label}>I'M JOINING AS</Text>
            <View style={styles.roles}>
              {(['customer', 'mechanic'] as Role[]).map((item) => <TouchableOpacity key={item} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleSelected]}>
                <Ionicons name={item === 'customer' ? 'car-outline' : 'construct-outline'} size={18} color={role === item ? '#0A1110' : '#B5C0B6'} />
                <Text style={[styles.roleText, role === item && styles.roleTextSelected]}>{item === 'customer' ? 'Customer' : 'Mechanic'}</Text>
              </TouchableOpacity>)}
            </View>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor="#78857C" style={styles.input} autoCapitalize="words" />
            <Text style={styles.label}>PHONE NUMBER (OPTIONAL)</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+234..." placeholderTextColor="#78857C" style={styles.input} keyboardType="phone-pad" />
          </>}
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#78857C" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor="#78857C" style={styles.input} secureTextEntry autoCapitalize="none" />
          <TouchableOpacity disabled={busy} onPress={submit} style={[styles.submit, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#0A1110" /> : <><Text style={styles.submitText}>{mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}</Text><Ionicons name="arrow-forward" size={17} color="#0A1110" /></>}
          </TouchableOpacity>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}</Text>
            <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}><Text style={styles.switchAction}>{mode === 'signup' ? 'Sign in' : 'Create account'}</Text></TouchableOpacity>
          </View>
          <Text style={styles.footnote}>Your login details are securely handled by Supabase.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A1110' }, flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 25, paddingVertical: 35 },
  brandMark: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#C7F36B', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  brand: { color: '#F0F4EE', fontSize: 17, fontWeight: '900', letterSpacing: 1.2 }, accent: { color: '#C7F36B' },
  kicker: { color: '#849188', fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginTop: 6, marginBottom: 43 },
  title: { color: '#F0F4EE', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: 8 },
  subtitle: { color: '#A0ADA3', fontSize: 13, lineHeight: 20, marginBottom: 26 },
  label: { color: '#A4B092', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8, marginTop: 14 },
  roles: { flexDirection: 'row', gap: 9 },
  role: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#141E19' },
  roleSelected: { backgroundColor: '#C7F36B', borderColor: '#C7F36B' },
  roleText: { color: '#B5C0B6', fontSize: 12, fontWeight: '800' }, roleTextSelected: { color: '#0A1110' },
  input: { height: 49, borderRadius: 12, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#141E19', paddingHorizontal: 14, color: '#F0F4EE', fontSize: 13 },
  submit: { height: 52, borderRadius: 13, backgroundColor: '#C7F36B', marginTop: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabled: { opacity: 0.65 }, submitText: { color: '#0A1110', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22 },
  switchText: { color: '#9AA69D', fontSize: 11 }, switchAction: { color: '#C7F36B', fontSize: 11, fontWeight: '900' },
  footnote: { color: '#65736A', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 31 },
});
