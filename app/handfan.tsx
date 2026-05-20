import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadHandFanResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

const MATERIALS_TABLE_ROWS = [
  ['Thin printer paper', '0.1', '0.05', 'Bends very easily'],
  ['Standard card stock', '0.25', '0.2', 'Moderate bend'],
  ['Thin cardboard', '0.5', '0.5', 'Much harder to bend'],
  ['Corrugated cardboard', '3', '2–3', 'Very stiff, almost no bend'],
] as const;

type Design = {
  design: string;
  bendAngle: string;
  outcome: string;
  notes: string;
  videoUri: string | null;
};

export default function HandFanScreen() {
  const router = useRouter();
  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Searching...');
  const [designs, setDesigns] = useState<Design[]>([
    { design: '', bendAngle: '', outcome: '', notes: '', videoUri: null },
    { design: '', bendAngle: '', outcome: '', notes: '', videoUri: null },
    { design: '', bendAngle: '', outcome: '', notes: '', videoUri: null },
  ]);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');
  const onPrimary = useThemeColor({}, 'onPrimary');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

  const updateDesign = (index: number, field: keyof Design, value: string) => {
    const updated = [...designs];
    (updated[index] as any)[field] = value;
    setDesigns(updated);
  };

  const recordVideo = async (index: number) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoMaxDuration: 30,
    });
    if (!result.canceled && result.assets[0]) {
      const updated = [...designs];
      updated[index].videoUri = result.assets[0].uri;
      setDesigns(updated);
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setIsSyncing(true);
    try {
      let locationData = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
      const teamData = await getTeamData();
      const bestBend = Math.max(...designs.map(d => parseFloat(d.bendAngle) || 0));

      await Promise.all([
        uploadHandFanResult(user.uid, teamData, designs, locationData),
        Promise.resolve(insertTrial(
          teamData?.name || 'unknown',
          'handfan',
          bestBend,
          '',
          locationData?.latitude || null,
          locationData?.longitude || null
        ))
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `Hand Fan results for ${teamData?.name || 'your team'} have been saved!`,
          data: { screen: 'handfan' },
        },
        trigger: null,
      });

      Alert.alert('Saved!', 'Your Hand Fan results have been saved.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error) {
      console.error('Hand Fan Save Error:', error);
      Alert.alert('Save Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const renderOverviewTab = () => (
    <SectionCard>
      <Text style={[styles.heroTitle, { color: text }]}>Hand Fan Challenge</Text>
      <Text style={[styles.heroSubtitle, { color: mutedText }]}>Physics – Air Movement</Text>
      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Students test how air movement affects flexible materials. By designing and using hand fans, teams discover how air force, material stiffness, and distance affect how much a paper strip bends.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        {['Paper and cardboard', 'Scissors', 'Mobile phone', 'Sticky Tape', 'STEMM Mobile App'].map((item, i) => (
          <Text key={i} style={[styles.bullet, { color: mutedText }]}>• {item}</Text>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        {[
          'Stand paper upright on a table.',
          'Fan air from 30 cm away.',
          'Observe and record the bend angle.',
          'Repeat with different fan designs.',
          'Repeat at distances of 15cm, 30cm, and 45cm.',
          'Repeat with cardboard instead of paper.',
        ].map((step, i) => (
          <Text key={i} style={[styles.bullet, { color: mutedText }]}>{i + 1}. {step}</Text>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Calculations</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.body, { color: mutedText }]}>Approximate force using F ≈ k · θ where:</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• F = force applied (N)</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• θ = bend angle (radians)</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• k = stiffness coefficient</Text>
      </View>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.sm }]}>Material Stiffness Values</Text>
      <View style={[styles.table, { borderColor: border }]}>
        <View style={[styles.tableHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
          {['Material', 'Thickness', 'k (N/rad)', 'Notes'].map((h, i) => (
            <Text key={i} style={[styles.tableHeaderCell, { color: text, flex: i === 0 || i === 3 ? 2 : 1 }]}>{h}</Text>
          ))}
        </View>
        {MATERIALS_TABLE_ROWS.map((row, i) => (
          <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? background : card, borderBottomColor: border, borderBottomWidth: i < MATERIALS_TABLE_ROWS.length - 1 ? 1 : 0 }]}>
            {row.map((cell, j) => (
              <Text key={j} style={[styles.tableCell, { color: j === 0 ? text : mutedText, flex: j === 0 || j === 3 ? 2 : 1, fontWeight: j === 0 ? '700' : '400' }]}>{cell}</Text>
            ))}
          </View>
        ))}
      </View>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.sm }]}>Example</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Thin paper (k = 0.05), bend = 30° → θ ≈ 0.524 rad{'\n'}
        F ≈ 0.05 × 0.524 ≈ 0.026 N{'\n\n'}
        Cardboard (k = 0.5), same bend:{'\n'}
        F ≈ 0.5 × 0.524 ≈ 0.26 N{'\n\n'}
        Force required increases strongly with stiffness.
      </Text>

      <View style={[styles.diagramCard, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.diagramText, { color: mutedText }]}>
          [Diagram: Fan → 30cm → Paper strip upright on table. Measure bend angle from vertical.]
        </Text>
      </View>
    </SectionCard>
  );

  const renderExperimentTab = () => (
    <View style={styles.experimentWrap}>
      <View style={[styles.infoCard, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.body, { color: mutedText }]}>
          For each design, record a video of the paper bending, then fill in the bend angle and outcome below.
        </Text>
        <Text style={[styles.helper, { color: mutedText, marginTop: Spacing.xs }]}>GPS Status: {locationStatus}</Text>
      </View>

      {designs.map((d, i) => (
        <SectionCard key={i}>
          <Text style={[styles.sectionTitle, { color: text }]}>Design {i + 1}</Text>

          <Text style={[styles.inputLabel, { color: mutedText }]}>Fan design description</Text>
          <TextInput
            style={[styles.inputBox, { borderColor: border, color: text, backgroundColor: background }]}
            placeholder="e.g. 1cm back and forward folds"
            placeholderTextColor={mutedText}
            value={d.design}
            onChangeText={v => updateDesign(i, 'design', v)}
          />

          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: mutedText }]}>Bend angle (°)</Text>
              <TextInput
                style={[styles.inputBox, { borderColor: border, color: text, backgroundColor: background }]}
                placeholder="e.g. 30"
                placeholderTextColor={mutedText}
                keyboardType="numeric"
                value={d.bendAngle}
                onChangeText={v => updateDesign(i, 'bendAngle', v)}
              />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: mutedText }]}>Outcome (°)</Text>
              <TextInput
                style={[styles.inputBox, { borderColor: border, color: text, backgroundColor: background }]}
                placeholder="e.g. 28"
                placeholderTextColor={mutedText}
                keyboardType="numeric"
                value={d.outcome}
                onChangeText={v => updateDesign(i, 'outcome', v)}
              />
            </View>
          </View>

          <PrimaryButton
            label={d.videoUri ? 'Re-record Video' : 'Record Video'}
            variant={d.videoUri ? 'secondary' : 'primary'}
            onPress={() => recordVideo(i)}
            style={{ marginTop: Spacing.sm }}
          />

          {d.videoUri && (
            <View style={{ marginTop: Spacing.sm }}>
              <Text style={[styles.inputLabel, { color: mutedText }]}>Recorded video</Text>
              <Video
                source={{ uri: d.videoUri }}
                style={styles.videoPlayer}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
              />
            </View>
          )}
        </SectionCard>
      ))}

      <PrimaryButton
        label={isSyncing ? 'Saving...' : 'Finish & Save Results'}
        onPress={handleSave}
        disabled={isSyncing}
        style={{ borderColor: primary }}
      />
    </View>
  );

  const renderWriteupTab = () => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Write-up (on paper)</Text>
      <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.md }]}>
        Use the questions below to complete your write-up in your exercise book.
      </Text>

      {[
        'Predict which fan design makes the paper move the most.',
        'Record the results.',
        'Were you right? Any surprises?',
        'How does material stiffness affect the bend angle?',
        'How does fan design influence air velocity and resulting paper movement?',
        'How does distance from the fan affect bending?',
      ].map((q, i) => (
        <View key={i} style={[styles.questionBlock, { borderTopColor: border }]}>
          <Text style={[styles.questionNumber, { color: primary }]}>{i + 1}.</Text>
          <Text style={[styles.questionText, { color: text }]}>{q}</Text>
        </View>
      ))}

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Table Template</Text>
      <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.sm }]}>Copy this table into your exercise book.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.table, { borderColor: border, minWidth: 560 }]}>
          <View style={[styles.tableHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
            {['Design', 'Bend (°)', 'Outcome (°)', 'Observation Notes: Were you right?'].map((h, i) => (
              <Text key={i} style={[styles.tableHeaderCell, { color: text, width: i === 0 || i === 3 ? 180 : 90 }]}>{h}</Text>
            ))}
          </View>
          {['Design 1 (e.g. 1cm back and forward folds)', 'Design 2 (e.g. no folds)', 'Design 3'].map((label, i) => (
            <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? background : card, borderBottomColor: border, borderBottomWidth: i < 2 ? 1 : 0 }]}>
              <Text style={[styles.tableCell, { color: text, width: 180, fontWeight: '700' }]}>{label}</Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 90 }]}> </Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 90 }]}> </Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 180 }]}> </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SectionCard>
  );

  const renderDiscussionTab = () => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Discussion</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Moving air applies force to objects. Paper bends because it is flexible. Stiffer materials bend less because they resist the force more strongly.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Why does cardboard bend less than paper?</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Cardboard has a higher stiffness coefficient (k). It needs a much larger force to produce the same bend angle. Thin paper bends easily because its k value is very low (0.05 N/rad), while cardboard can be 10x stiffer.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Why does closer distance create stronger movement?</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Air slows down and spreads out as it travels further from the fan. At 15cm, the air stream is faster and more concentrated, creating more force. At 45cm, the same fan produces noticeably less movement.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Why do different fan designs create different airflow?</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Folded fans with more surface area push more air per stroke. Tighter folds create a focused stream of air. A flat, unfolded sheet pushes air but loses much of it to the sides rather than directing it forward.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Curriculum Links</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACSSU076 — Forces and motion</Text>
      </View>
    </SectionCard>
  );

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map(tab => {
          const isActive = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[styles.tabPill, { backgroundColor: isActive ? primary : card, borderColor: isActive ? primary : border }]}
            >
              <Text style={[styles.tabPillText, { color: isActive ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {screenTab === 'overview' && renderOverviewTab()}
      {screenTab === 'experiment' && renderExperimentTab()}
      {screenTab === 'writeup' && renderWriteupTab()}
      {screenTab === 'discussion' && renderDiscussionTab()}

      <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.back()} disabled={isSyncing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs },
  tabPillText: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  heroTitle: { ...Typography.hero, fontSize: 26 },
  heroSubtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bodyHeading: { ...Typography.section, fontSize: 14, marginBottom: Spacing.xs },
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  diagramCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  diagramText: { ...Typography.body, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  experimentWrap: { gap: Spacing.md },
  infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  helper: { ...Typography.small },
  inputLabel: { ...Typography.small, marginBottom: 4, marginTop: Spacing.sm },
  inputBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', marginTop: Spacing.sm },
  videoPlayer: { width: '100%', height: 200, borderRadius: Radius.lg },
  questionBlock: { flexDirection: 'row', gap: Spacing.sm, borderTopWidth: 1, paddingVertical: Spacing.sm, alignItems: 'flex-start' },
  questionNumber: { ...Typography.section, fontSize: 14, minWidth: 20 },
  questionText: { ...Typography.body, fontSize: 13, lineHeight: 20, flex: 1 },
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  tableHeaderCell: { ...Typography.small, fontWeight: '800', fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'flex-start' },
  tableCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
});