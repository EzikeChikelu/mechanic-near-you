import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Role = 'customer' | 'mechanic';
type LocationWatcher = Location.LocationSubscription;
type Specialty = 'All' | 'Electrical' | 'Engine' | 'Tyres' | 'Diagnostics';

type Mechanic = {
  id: string;
  name: string;
  initials: string;
  specialty: Exclude<Specialty, 'All'>;
  distance: string;
  rating: string;
  jobs: number;
  eta: string;
  phone: string;
  verified: boolean;
  available: boolean;
  color: string;
};

const mechanicColors = ['#C7F36B', '#A8C8FF', '#F5C58A', '#D9B6FF'];

const filters: Specialty[] = ['All', 'Electrical', 'Engine', 'Tyres', 'Diagnostics'];

function IconButton({ name, onPress }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconButton} activeOpacity={0.75}>
      <Ionicons name={name} size={19} color="#EAF0E8" />
    </TouchableOpacity>
  );
}

function MechanicCard({ mechanic }: { mechanic: Mechanic }) {
  const call = () => mechanic.phone ? Linking.openURL('tel:' + mechanic.phone).catch(() => Alert.alert('Unable to call', 'Please try again.')) : Alert.alert('Phone number unavailable', 'This mechanic has not added a contact number yet.');
  const request = () => Alert.alert('Booking coming next', 'You can call this mechanic when a phone number is available. In-app service requests are the next feature being built.', [{ text: 'Got it' }]);

  return (
    <View style={styles.mechanicCard}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: mechanic.color }]}>
          <Text style={styles.avatarText}>{mechanic.initials}</Text>
        </View>
        <View style={styles.mechanicInfo}>
          <View style={styles.nameLine}>
            <Text style={styles.mechanicName}>{mechanic.name}</Text>
            {mechanic.verified && <Ionicons name="checkmark-circle" size={15} color="#C7F36B" />}
          </View>
          <Text style={styles.specialty}>{mechanic.specialty} specialist</Text>
          <View style={styles.ratingLine}>
            <Ionicons name="star" size={12} color="#F6C96B" />
            <Text style={styles.rating}>{mechanic.rating}</Text>
            <Text style={styles.mutedSmall}>· {mechanic.jobs} jobs</Text>
          </View>
        </View>
        <View style={styles.distanceWrap}>
          <Text style={styles.distance}>{mechanic.distance}</Text>
          <Text style={styles.mutedTiny}>away</Text>
        </View>
      </View>
      <View style={styles.cardDivider} />
      <View style={styles.cardBottom}>
        <View style={styles.etaLine}>
          <Ionicons name="time-outline" size={14} color="#C7F36B" />
          <Text style={styles.etaText}>~{mechanic.eta} response</Text>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Available</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.callButton} onPress={call} activeOpacity={0.8}>
            <Ionicons name="call-outline" size={16} color="#0B110D" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.requestButton} onPress={request} activeOpacity={0.8}>
            <Text style={styles.requestButtonText}>Request help</Text>
            <Ionicons name="arrow-up-right-box" size={15} color="#C7F36B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function MapPreview() {
  return (
    <View style={styles.mapPreview}>
      <View style={styles.mapGrid} />
      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={[styles.road, styles.roadFour]} />
      <View style={styles.mapLabelOne}><Text style={styles.mapLabel}>ADEKUNLE STREET</Text></View>
      <View style={styles.mapLabelTwo}><Text style={styles.mapLabel}>HERBERT MACAULAY WAY</Text></View>
      <View style={styles.mapLegend}><Ionicons name="map-outline" size={16} color="#C7F36B" /><Text style={styles.legendText}>Live map will appear after map provider setup</Text></View>
      <View style={styles.mapCaption}><Ionicons name="location" size={12} color="#C7F36B" /><Text style={styles.mapCaptionText}>Your exact location is not shown to mechanics</Text></View>
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState<Role>('customer');
  const [filter, setFilter] = useState<Specialty>('All');
  const [search, setSearch] = useState('');
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState('Explore');
  const [profileOpen, setProfileOpen] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [nearbyMechanics, setNearbyMechanics] = useState<Mechanic[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyMessage, setNearbyMessage] = useState('Tap Find mechanics to search for verified professionals near your location.');
  const locationWatcher = useRef<LocationWatcher | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data.session);
        setAuthReady(true);
      }
    }).catch(() => {
      if (alive) setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        locationWatcher.current?.remove();
        locationWatcher.current = null;
        setLocationSharing(false);
        setOnline(false);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('role').eq('id', session.user.id).single().then(({ data }) => {
      if (data?.role === 'customer' || data?.role === 'mechanic') {
        setRole(data.role);
        setTab(data.role === 'customer' ? 'Explore' : 'Dashboard');
      }
    });
  }, [session]);

  useEffect(() => {
    if (!session || role !== 'mechanic') return;
    let active = true;
    supabase.from('mechanic_profiles').select('is_online').eq('user_id', session.user.id).maybeSingle()
      .then(async ({ data, error }) => {
        if (!active || error) return;
        // Foreground location watching does not survive an app restart. Never
        // restore an online state without a fresh, user-initiated location session.
        if (data?.is_online) {
          await supabase.from('mechanic_profiles')
            .update({ is_online: false, updated_at: new Date().toISOString() })
            .eq('user_id', session.user.id);
          await supabase.from('mechanic_locations').delete().eq('mechanic_id', session.user.id);
        }
        if (active) {
          setOnline(false);
          setLocationSharing(false);
        }
      });
    return () => { active = false; };
  }, [session, role]);

  const visibleMechanics = useMemo(() => nearbyMechanics.filter((item) => {
    const matchesFilter = filter === 'All' || item.specialty === filter;
    const matchesSearch = (item.name + ' ' + item.specialty).toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  }), [nearbyMechanics, filter, search]);

  const findNearbyMechanics = async () => {
    if (!session || nearbyLoading) return;
    setNearbyLoading(true);
    setNearbyMessage('Getting your location and searching nearby…');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setNearbyMessage('Location permission is needed to find mechanics near you.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { data, error } = await supabase.rpc('find_nearby_mechanics', {
        customer_lat: position.coords.latitude,
        customer_lon: position.coords.longitude,
        radius_m: 15000,
      });
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        mechanic_id: string; display_name: string | null; phone: string | null;
        distance_m: number; average_rating: number | null; completed_jobs: number | null;
        services: string[] | null;
      }>;
      const mapped: Mechanic[] = rows.map((item, index) => {
        const services = item.services ?? [];
        const label = services.join(' ').toLowerCase();
        const specialty: Exclude<Specialty, 'All'> =
          /electric|battery|wiring/.test(label) ? 'Electrical' :
          /tyre|tire|wheel/.test(label) ? 'Tyres' :
          /diagnostic|scan/.test(label) ? 'Diagnostics' : 'Engine';
        const name = item.display_name?.trim() || 'Verified mechanic';
        return {
          id: item.mechanic_id,
          name,
          initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
          specialty,
          distance: item.distance_m < 1000 ? `${item.distance_m} m` : `${(item.distance_m / 1000).toFixed(1)} km`,
          rating: item.average_rating == null ? 'New' : Number(item.average_rating).toFixed(1),
          jobs: item.completed_jobs ?? 0,
          eta: '—',
          phone: item.phone ?? '',
          verified: true,
          available: true,
          color: mechanicColors[index % mechanicColors.length],
        };
      });
      setNearbyMechanics(mapped);
      setNearbyMessage(mapped.length ? 'Showing verified mechanics within 15 km. Distances are approximate.' : 'No verified mechanics are online nearby right now. Try again later or expand your search area.');
    } catch (error) {
      setNearbyMessage(error instanceof Error ? error.message : 'Could not search nearby mechanics. Please try again.');
    } finally {
      setNearbyLoading(false);
    }
  };

  const stopLocationSharing = async () => {
    locationWatcher.current?.remove();
    locationWatcher.current = null;
    setLocationSharing(false);
  };

  const startLocationSharing = async () => {
    if (!session) return;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access while using the app to share your live position with nearby customers. You can stay offline if you prefer not to share it.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = {
        mechanic_id: session.user.id,
        location: `POINT(${current.coords.longitude} ${current.coords.latitude})`,
        accuracy_m: current.coords.accuracy,
        heading: current.coords.heading,
        updated_at: new Date().toISOString(),
      };
      const { error: locationError } = await supabase.from('mechanic_locations').upsert(point, { onConflict: 'mechanic_id' });
      if (locationError) throw locationError;
      const { error: onlineError } = await supabase.from('mechanic_profiles')
        .update({ is_online: true, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);
      if (onlineError) throw onlineError;
      locationWatcher.current?.remove();
      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 50 },
        async (position) => {
          const { error } = await supabase.from('mechanic_locations').upsert({
            mechanic_id: session.user.id,
            location: `POINT(${position.coords.longitude} ${position.coords.latitude})`,
            accuracy_m: position.coords.accuracy,
            heading: position.coords.heading,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'mechanic_id' });
          if (error) console.warn('Location update failed:', error.message);
        },
      );
      setOnline(true);
      setLocationSharing(true);
    } catch (error) {
      await stopLocationSharing();
      await supabase.from('mechanic_profiles').update({ is_online: false, updated_at: new Date().toISOString() }).eq('user_id', session.user.id);
      await supabase.from('mechanic_locations').delete().eq('mechanic_id', session.user.id);
      Alert.alert('Could not start location sharing', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const toggleAvailability = async () => {
    if (!session) return;
    if (online) {
      await stopLocationSharing();
      const { error: locationError } = await supabase.from('mechanic_locations').delete().eq('mechanic_id', session.user.id);
      const { error } = await supabase.from('mechanic_profiles')
        .update({ is_online: false, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);
      if (error || locationError) {
        Alert.alert('Could not go offline', error?.message ?? locationError?.message ?? 'Please try again.');
        return;
      }
      setOnline(false);
      return;
    }
    Alert.alert(
      'Share your location?',
      'While you are using Mechanic Near You, your approximate live location will be shared with the service so nearby customers can find you. Updates stop when you go offline. This first version does not track you in the background.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Allow and go online', onPress: () => { void startLocationSharing(); } },
      ],
    );
  };

  const switchRole = (next: Role) => {
    setRole(next);
    setTab(next === 'customer' ? 'Explore' : 'Dashboard');
  };

  if (!authReady) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#C7F36B" />
        <Text style={{ color: '#A0ADA3', marginTop: 12, fontSize: 12 }}>Loading your account…</Text>
      </SafeAreaView>
    );
  }
  if (!session) return <AuthScreen />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1110" />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Ionicons name="construct" size={19} color="#0A1110" /></View>
          <View>
            <Text style={styles.brand}>MECHANIC<Text style={styles.brandAccent}> NEAR YOU</Text></Text>
            <Text style={styles.brandSub}>ROADSIDE HELP, RIGHT AROUND YOU</Text>
          </View>
        </View>
        <IconButton name="notifications-outline" onPress={() => Alert.alert('Notifications', 'You are all caught up.')} />
      </View>

      <View style={styles.roleSwitch}>
        <TouchableOpacity onPress={() => switchRole('customer')} style={[styles.roleOption, role === 'customer' && styles.roleActive]}>
          <Ionicons name="car-outline" size={16} color={role === 'customer' ? '#0A1110' : '#8D9990'} />
          <Text style={[styles.roleText, role === 'customer' && styles.roleTextActive]}>I need a mechanic</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => switchRole('mechanic')} style={[styles.roleOption, role === 'mechanic' && styles.roleActive]}>
          <Ionicons name="construct-outline" size={16} color={role === 'mechanic' ? '#0A1110' : '#8D9990'} />
          <Text style={[styles.roleText, role === 'mechanic' && styles.roleTextActive]}>I'm a mechanic</Text>
        </TouchableOpacity>
      </View>

      {role === 'customer' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.eyebrow}>MONDAY · LAGOS, NIGERIA</Text>
              <Text style={styles.headline}>Car trouble?{ '\n' }We've got you.</Text>
            </View>
            <View style={styles.helpBadge}><Ionicons name="shield-checkmark" size={17} color="#C7F36B" /><Text style={styles.helpBadgeText}>HELP IS CLOSE</Text></View>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#849188" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search mechanics or services" placeholderTextColor="#748078" style={styles.searchInput} />
            <Ionicons name="options-outline" size={18} color="#C7F36B" />
          </View>
          <MapPreview />
          <TouchableOpacity style={styles.goOnlineButton} onPress={findNearbyMechanics} disabled={nearbyLoading}>
            {nearbyLoading ? <ActivityIndicator color="#0A1110" /> : <><Ionicons name="navigate-outline" size={17} color="#0A1110" /><Text style={styles.goOnlineText}>FIND MECHANICS NEAR ME</Text></>}
          </TouchableOpacity>
          <Text style={styles.locationDisclaimer}>{nearbyMessage}</Text>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionTitle}>Verified mechanics nearby</Text><Text style={styles.sectionSub}>Online professionals within 15 km</Text></View>
            <Text style={styles.resultCount}>{visibleMechanics.length} FOUND</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {filters.map((item) => (
              <TouchableOpacity key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterActive]}>
                <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {visibleMechanics.map((mechanic) => <MechanicCard key={mechanic.id} mechanic={mechanic} />)}
          {!nearbyLoading && nearbyMechanics.length === 0 && <View style={styles.bottomNote}><Ionicons name="information-circle-outline" size={15} color="#89968D" /><Text style={styles.bottomNoteText}>Only verified mechanics who are online and have shared a recent location can appear here.</Text></View>}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>MECHANIC WORKSPACE</Text>
          <Text style={styles.headline}>Your next job{ '\n' }starts here.</Text>
          <View style={styles.onlineCard}>
            <View style={styles.onlineCardTop}>
              <View><Text style={styles.onlineCardLabel}>YOUR AVAILABILITY</Text><Text style={styles.onlineCardTitle}>{online ? 'You are online' : 'You are offline'}</Text></View>
              <View style={[styles.bigStatus, online && styles.bigStatusActive]}><View style={[styles.bigStatusDot, online && styles.bigStatusDotActive]} /></View>
            </View>
            <Text style={styles.onlineDescription}>{online ? 'You can be discovered by customers nearby while location sharing is active.' : 'Go online when you are ready to receive roadside assistance requests.'}</Text>
            <TouchableOpacity style={[styles.goOnlineButton, online && styles.goOfflineButton]} onPress={toggleAvailability}>
              <Ionicons name={online ? 'pause-circle-outline' : 'radio-outline'} size={18} color={online ? '#EAF0E8' : '#0A1110'} />
              <Text style={[styles.goOnlineText, online && styles.goOfflineText]}>{online ? 'GO OFFLINE' : 'GO ONLINE'}</Text>
            </TouchableOpacity>
            <Text style={styles.locationDisclaimer}>{locationSharing ? 'Location sharing is active while this app is open. Go offline to stop sharing and remove your saved location.' : 'Go online to share your location while using the app. Background tracking is not enabled.'}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}><Text style={styles.statNumber}>0</Text><Text style={styles.statLabel}>New requests</Text></View>
            <View style={styles.statCard}><Text style={styles.statNumber}>—</Text><Text style={styles.statLabel}>Your rating</Text></View>
            <View style={styles.statCard}><Text style={styles.statNumber}>0</Text><Text style={styles.statLabel}>Jobs done</Text></View>
          </View>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Get started</Text><Text style={styles.sectionSub}>Set up your mechanic profile</Text></View></View>
          {[
            ['person-circle-outline', 'Complete your profile', 'Add your name, photo and experience'],
            ['build-outline', 'Add your services', 'Choose the repairs you specialise in'],
            ['shield-checkmark-outline', 'Get verified', 'Build trust with customers nearby'],
            ['call-outline', 'Add your phone number', 'Let customers reach you directly'],
          ].map(([icon, title, subtitle]) => (
            <TouchableOpacity key={title} style={styles.setupRow} onPress={() => setProfileOpen(true)}>
              <View style={styles.setupIcon}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={19} color="#C7F36B" /></View>
              <View style={styles.setupCopy}><Text style={styles.setupTitle}>{title}</Text><Text style={styles.setupSubtitle}>{subtitle}</Text></View>
              <Ionicons name="chevron-forward" size={17} color="#819087" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={profileOpen} animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        {session && <ProfileSetupScreen userId={session.user.id} role={role} onClose={() => setProfileOpen(false)} />}
      </Modal>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab(role === 'customer' ? 'Explore' : 'Dashboard')}>
          <Ionicons name={role === 'customer' ? 'compass' : 'grid'} size={20} color="#C7F36B" /><Text style={styles.tabActiveText}>{role === 'customer' ? 'Explore' : 'Dashboard'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => Alert.alert('Activity', 'Your requests and job history will appear here.')}>
          <Ionicons name="time-outline" size={20} color="#78857C" /><Text style={styles.tabText}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => Alert.alert('Messages', 'Your customer and mechanic conversations will appear here.')}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#78857C" /><Text style={styles.tabText}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setProfileOpen(true)}>
          <Ionicons name="person-outline" size={20} color="#78857C" /><Text style={styles.tabText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A1110' },
  header: { height: 66, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1D2923' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#C7F36B', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#F0F4EE', fontSize: 13, fontWeight: '900', letterSpacing: 1.1 },
  brandAccent: { color: '#C7F36B' },
  brandSub: { color: '#819087', fontSize: 8, letterSpacing: 1.25, marginTop: 3, fontWeight: '700' },
  iconButton: { width: 39, height: 39, borderRadius: 13, borderWidth: 1, borderColor: '#26332C', alignItems: 'center', justifyContent: 'center' },
  roleSwitch: { marginHorizontal: 20, marginTop: 14, padding: 4, backgroundColor: '#141E19', borderRadius: 14, flexDirection: 'row' },
  roleOption: { flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', paddingVertical: 11, borderRadius: 11 },
  roleActive: { backgroundColor: '#C7F36B' },
  roleText: { color: '#98A49B', fontSize: 11, fontWeight: '700' },
  roleTextActive: { color: '#0A1110' },
  content: { paddingHorizontal: 20, paddingTop: 23, paddingBottom: 28 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 19 },
  eyebrow: { color: '#A4B092', fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 9 },
  headline: { color: '#F0F4EE', fontSize: 32, lineHeight: 37, fontWeight: '800', letterSpacing: -1.1 },
  helpBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1A281B', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7, marginBottom: 4 },
  helpBadgeText: { color: '#C7F36B', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  searchBox: { height: 49, backgroundColor: '#141E19', borderWidth: 1, borderColor: '#27352C', borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, marginBottom: 15 },
  searchInput: { flex: 1, color: '#F0F4EE', fontSize: 12, paddingVertical: 0 },
  mapPreview: { height: 185, backgroundColor: '#17251F', borderRadius: 17, borderWidth: 1, borderColor: '#2B3C30', overflow: 'hidden', position: 'relative', marginBottom: 23 },
  mapGrid: { ...StyleSheet.absoluteFillObject, opacity: 0.35, backgroundColor: '#1A2B22' },
  road: { position: 'absolute', height: 8, backgroundColor: '#35473A', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#50614A', borderRadius: 8 },
  roadOne: { width: '120%', top: 65, left: -20, transform: [{ rotate: '-17deg' }] },
  roadTwo: { width: '120%', top: 125, left: -20, transform: [{ rotate: '13deg' }] },
  roadThree: { width: 220, top: 80, left: 45, transform: [{ rotate: '75deg' }] },
  roadFour: { width: 200, top: 65, right: -50, transform: [{ rotate: '105deg' }] },
  mapLabelOne: { position: 'absolute', top: 20, left: 12 },
  mapLabelTwo: { position: 'absolute', bottom: 43, right: 10 },
  mapLabel: { color: '#91A18F', fontSize: 7, fontWeight: '800', letterSpacing: 1 },
  pin: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#C7F36B', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#30402B' },
  youPin: { position: 'absolute', top: 83, left: '44%', width: 23, height: 23, borderRadius: 12, backgroundColor: '#D9E7FF', borderWidth: 5, borderColor: '#59759C', alignItems: 'center', justifyContent: 'center' },
  youPinCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#1B3B68' },
  mapLegend: { position: 'absolute', bottom: 10, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#101A15', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D9E7FF' },
  legendMechanic: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C7F36B', marginLeft: 5 },
  legendText: { color: '#C6D0C7', fontSize: 8, fontWeight: '600' },
  mapCaption: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#101A15', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  mapCaptionText: { color: '#D4DDD3', fontSize: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: '#F0F4EE', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { color: '#849188', fontSize: 10, marginTop: 4 },
  resultCount: { color: '#C7F36B', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  filters: { gap: 7, paddingBottom: 13 },
  filterChip: { borderRadius: 20, borderWidth: 1, borderColor: '#2A382F', paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#111A15' },
  filterActive: { backgroundColor: '#C7F36B', borderColor: '#C7F36B' },
  filterText: { color: '#A8B2AA', fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: '#0A1110' },
  mechanicCard: { backgroundColor: '#131D17', borderWidth: 1, borderColor: '#29362E', borderRadius: 16, padding: 13, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#101711', fontWeight: '900', fontSize: 13 },
  mechanicInfo: { flex: 1, marginLeft: 11 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mechanicName: { color: '#F0F4EE', fontSize: 12, fontWeight: '800' },
  specialty: { color: '#9AA69D', fontSize: 10, marginTop: 3 },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  rating: { color: '#E6EBDD', fontSize: 9, fontWeight: '800' },
  mutedSmall: { color: '#77857B', fontSize: 9 },
  distanceWrap: { alignItems: 'flex-end' },
  distance: { color: '#C7F36B', fontSize: 12, fontWeight: '900' },
  mutedTiny: { color: '#77857B', fontSize: 9, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: '#28352D', marginVertical: 12 },
  cardBottom: { gap: 11 },
  etaLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  etaText: { color: '#B9C5BA', fontSize: 9, fontWeight: '600' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#80DB8C', marginLeft: 5 },
  onlineText: { color: '#80DB8C', fontSize: 9, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8 },
  callButton: { height: 37, flex: 1, borderRadius: 10, backgroundColor: '#C7F36B', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  callButtonText: { color: '#0A1110', fontSize: 11, fontWeight: '900' },
  requestButton: { height: 37, flex: 1.5, borderRadius: 10, borderWidth: 1, borderColor: '#45553D', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  requestButtonText: { color: '#DDE7D9', fontSize: 10, fontWeight: '800' },
  bottomNote: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 7, paddingHorizontal: 2 },
  bottomNoteText: { color: '#89968D', fontSize: 9, lineHeight: 14, flex: 1 },
  onlineCard: { backgroundColor: '#151F19', borderRadius: 18, borderWidth: 1, borderColor: '#30402F', padding: 17, marginTop: 23 },
  onlineCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  onlineCardLabel: { color: '#A0AE9D', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  onlineCardTitle: { color: '#F0F4EE', fontSize: 23, fontWeight: '800', marginTop: 7 },
  bigStatus: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#29332C', alignItems: 'center', justifyContent: 'center' },
  bigStatusActive: { backgroundColor: '#25391F' },
  bigStatusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#77857B' },
  bigStatusDotActive: { backgroundColor: '#C7F36B' },
  onlineDescription: { color: '#A2ADA4', fontSize: 11, lineHeight: 17, marginTop: 15 },
  goOnlineButton: { height: 47, borderRadius: 12, backgroundColor: '#C7F36B', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 17 },
  goOnlineText: { color: '#0A1110', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  goOfflineButton: { backgroundColor: '#27332B', borderWidth: 1, borderColor: '#435044' },
  goOfflineText: { color: '#EAF0E8' },
  locationDisclaimer: { color: '#7F8D82', fontSize: 9, lineHeight: 14, marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 13, marginBottom: 27 },
  statCard: { flex: 1, backgroundColor: '#141E19', borderWidth: 1, borderColor: '#26342B', borderRadius: 13, padding: 12 },
  statNumber: { color: '#C7F36B', fontSize: 21, fontWeight: '900' },
  statLabel: { color: '#8C998F', fontSize: 9, marginTop: 5 },
  setupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#202D25' },
  setupIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#1B2A1D', alignItems: 'center', justifyContent: 'center' },
  setupCopy: { flex: 1 },
  setupTitle: { color: '#EAF0E8', fontSize: 11, fontWeight: '800' },
  setupSubtitle: { color: '#849188', fontSize: 9, marginTop: 4 },
  tabBar: { height: 65, borderTopWidth: 1, borderTopColor: '#253129', backgroundColor: '#0E1712', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 4 },
  tabItem: { minWidth: 58, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabActiveText: { color: '#C7F36B', fontSize: 9, fontWeight: '800' },
  tabText: { color: '#78857C', fontSize: 9, fontWeight: '600' },
});
