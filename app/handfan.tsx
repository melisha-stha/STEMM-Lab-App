import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadHandFanResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

type Tab = 'overview' | 'experiment' | 'writeup' | 'discussion';

const MATERIALS = [
  { name: 'Thin printer paper', thickness: '0.1mm', stiffness: 'k = 0.05', note: 'Bends very easily' },
  { name: 'Standard card stock', thickness: '0.25mm', stiffness: 'k = 0.2', note: 'Moderate bend' },
  { name: 'Thin cardboard', thickness: '0.5mm', stiffness: 'k = 0.5', note: 'Much harder to bend' },
  { name: 'Corrugated cardboard', thickness: '3mm', stiffness: 'k = 2–3', note: 'Very stiff, almost no bend' },
];

export default function HandFanScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [designs, setDesigns] = useState([
    { design: '', bendAngle: '', outcome: '', notes: '' },
    { design: '', bendAngle: '', outcome: '', notes: '' },
    { design: '', bendAngle: '', outcome: '', notes: '' },
  ]);
  const [prediction, setPrediction] = useState('');
  const [wereYouRight, setWereYouRight] = useState('');
  const [surprises, setSurprises] = useState('');

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'experiment', label: 'Experiment' },
    { key: 'writeup', label: 'Write-up' },
    { key: 'discussion', label: 'Discussion' },
  ];

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to record the experiment.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) return result.assets[0].uri;
    return null;
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
        uploadHandFanResult(user.uid, teamData, designs, prediction, wereYouRight, surprises, locationData),
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

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { borderBottomColor: border }]}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && { backgroundColor: primary, borderRadius: Radius.pill }]}
          >
            <Text style={[styles.tabText, { color: activeTab === tab.key ? '#fff' : mutedText }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            <SectionCard>
              <Text style={[styles.activityTitle, { color: text }]}>Hand Fan Challenge</Text>
              <Text style={[styles.activityTag, { color: primary }]}>Physics – Air Movement</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Students test how air movement affects flexible materials. By designing and using hand fans, teams discover how air force, material stiffness, and distance affect how much a paper strip bends.
              </Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Equipment</Text>
              <View style={[styles.divider, { borderTopColor: border }]} />
              {['Paper and cardboard', 'Scissors', 'Mobile phone', 'Sticky Tape', 'STEMM Mobile App'].map((item, i) => (
                <Text key={i} style={[styles.bullet, { color: mutedText }]}>• {item}</Text>
              ))}
            </SectionCard>

            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Instructions</Text>
              <View style={[styles.divider, { borderTopColor: border }]} />
              {[
                'Stand paper upright on a table.',
                'Fan air from 30 cm away.',
                'Observe and record the bend angle.',
                'Repeat with different fan designs.',
                'Repeat at different distances (15cm, 30cm, 45cm).',
                'Repeat with cardboard instead of paper.',
              ].map((step, i) => (
                <Text key={i} style={[styles.bullet, { color: mutedText }]}>{i + 1}. {step}</Text>
              ))}
            </SectionCard>

            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Calculations</Text>
              <View style={[styles.divider, { borderTopColor: border }]} />
              <Text style={[styles.body, { color: mutedText }]}>
                Approximate force using F ≈ k · θ where:
              </Text>
              <Text style={[styles.bullet, { color: mutedText }]}>• F = force applied (N)</Text>
              <Text style={[styles.bullet, { color: mutedText }]}>• θ = bend angle (radians)</Text>
              <Text style={[styles.bullet, { color: mutedText }]}>• k = stiffness coefficient</Text>

              <Text style={[styles.subTitle, { color: text, marginTop: Spacing.sm }]}>Material Stiffness Values</Text>
              {MATERIALS.map((m, i) => (
                <View key={i} style={[styles.materialRow, { borderTopColor: border, borderTopWidth: i === 0 ? 0 : 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.materialName, { color: text }]}>{m.name}</Text>
                    <Text style={[styles.materialDetail, { color: mutedText }]}>{m.thickness} · {m.stiffness} N/rad</Text>
                  </View>
                  <Text style={[styles.materialNote, { color: primary }]}>{m.note}</Text>
                </View>
              ))}

              <Text style={[styles.subTitle, { color: text, marginTop: Spacing.sm }]}>Example</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Thin paper (k = 0.05), bend = 30° → θ ≈ 0.524 rad{'\n'}
                F ≈ 0.05 × 0.524 ≈ 0.026 N{'\n\n'}
                Cardboard (k = 0.5), same bend:{'\n'}
                F ≈ 0.5 × 0.524 ≈ 0.26 N{'\n\n'}
                Force required increases strongly with stiffness.
              </Text>
            </SectionCard>

            <PrimaryButton
              label="Carry Out Experiment →"
              onPress={() => setActiveTab('experiment')}
            />
          </>
        )}

        {/* EXPERIMENT TAB */}
        {activeTab === 'experiment' && (
          <>
            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Record Your Experiment</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Use the camera to record the paper strip bending as you fan it. Try to capture the maximum bend angle clearly.
              </Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Diagram</Text>
              <View style={[styles.diagram, { borderColor: border }]}>
                <Text style={[styles.diagramText, { color: mutedText }]}>
                  📐 Fan → 30cm → [Paper strip upright]{'\n\n'}
                  Measure the bend angle from vertical.{'\n'}
                  Use a ruler or protractor in frame for scale.
                </Text>
              </View>
            </SectionCard>

            <PrimaryButton
              label="📹 Record Experiment Video"
              onPress={async () => {
                const uri = await recordVideo();
                if (uri) Alert.alert('Recorded!', 'Video saved. Move to Write-up to record your results.');
              }}
            />

            <PrimaryButton
              label="Go to Write-up →"
              variant="secondary"
              onPress={() => setActiveTab('writeup')}
              style={{ marginTop: Spacing.sm }}
            />
          </>
        )}

        {/* WRITE-UP TAB */}
        {activeTab === 'writeup' && (
          <>
            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Write-up</Text>
              <Text style={[styles.body, { color: mutedText }]}>Answer the questions below and fill in your results table.</Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.question, { color: text }]}>Predict which fan design makes the paper move the most.</Text>
              <TextInput
                style={[styles.input, { borderColor: border, color: text, backgroundColor: background }]}
                placeholder="Your prediction..."
                placeholderTextColor={mutedText}
                value={prediction}
                onChangeText={setPrediction}
                multiline
              />
            </SectionCard>

            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Record the Results</Text>
              <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.sm }]}>
                Fill in each design's bend angle and outcome.
              </Text>

              {/* Table Header */}
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: card, borderColor: border }]}>
                <Text style={[styles.tableHead, { color: text, flex: 2 }]}>Design</Text>
                <Text style={[styles.tableHead, { color: text, flex: 1 }]}>Bend (°)</Text>
                <Text style={[styles.tableHead, { color: text, flex: 1 }]}>Outcome (°)</Text>
                <Text style={[styles.tableHead, { color: text, flex: 2 }]}>Notes</Text>
              </View>

              {designs.map((row, i) => (
                <View key={i} style={[styles.tableRow, { borderColor: border, backgroundColor: i % 2 === 0 ? card : background }]}>
                  <TextInput
                    style={[styles.tableInput, { color: text, flex: 2 }]}
                    placeholder={`Design ${i + 1}`}
                    placeholderTextColor={mutedText}
                    value={row.design}
                    onChangeText={v => {
                      const updated = [...designs];
                      updated[i].design = v;
                      setDesigns(updated);
                    }}
                  />
                  <TextInput
                    style={[styles.tableInput, { color: text, flex: 1 }]}
                    placeholder="e.g. 30"
                    placeholderTextColor={mutedText}
                    keyboardType="numeric"
                    value={row.bendAngle}
                    onChangeText={v => {
                      const updated = [...designs];
                      updated[i].bendAngle = v;
                      setDesigns(updated);
                    }}
                  />
                  <TextInput
                    style={[styles.tableInput, { color: text, flex: 1 }]}
                    placeholder="e.g. 28"
                    placeholderTextColor={mutedText}
                    keyboardType="numeric"
                    value={row.outcome}
                    onChangeText={v => {
                      const updated = [...designs];
                      updated[i].outcome = v;
                      setDesigns(updated);
                    }}
                  />
                  <TextInput
                    style={[styles.tableInput, { color: text, flex: 2 }]}
                    placeholder="Observation..."
                    placeholderTextColor={mutedText}
                    value={row.notes}
                    onChangeText={v => {
                      const updated = [...designs];
                      updated[i].notes = v;
                      setDesigns(updated);
                    }}
                  />
                </View>
              ))}
            </SectionCard>

            <SectionCard>
              <Text style={[styles.question, { color: text }]}>Were you right?</Text>
              <TextInput
                style={[styles.input, { borderColor: border, color: text, backgroundColor: background }]}
                placeholder="Compare your prediction to your results..."
                placeholderTextColor={mutedText}
                value={wereYouRight}
                onChangeText={setWereYouRight}
                multiline
              />
              <Text style={[styles.question, { color: text, marginTop: Spacing.sm }]}>Any surprises?</Text>
              <TextInput
                style={[styles.input, { borderColor: border, color: text, backgroundColor: background }]}
                placeholder="Anything unexpected?"
                placeholderTextColor={mutedText}
                value={surprises}
                onChangeText={setSurprises}
                multiline
              />
            </SectionCard>

            <PrimaryButton
              label={isSyncing ? 'Saving...' : 'Save Results'}
              onPress={handleSave}
              disabled={isSyncing}
            />
            <PrimaryButton
              label="Go to Discussion →"
              variant="secondary"
              onPress={() => setActiveTab('discussion')}
              style={{ marginTop: Spacing.sm }}
            />
          </>
        )}

        {/* DISCUSSION TAB */}
        {activeTab === 'discussion' && (
          <>
            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Discussion</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Moving air applies force to objects. Paper bends because it is flexible. Stiffer materials bend less because they resist the force more strongly.
              </Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.subTitle, { color: text }]}>Why does cardboard bend less than paper?</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Cardboard has a higher stiffness coefficient (k). This means it needs a much larger force to produce the same bend angle. Thin paper bends easily because its k value is very low (0.05 N/rad), while cardboard can be 10× stiffer.
              </Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.subTitle, { color: text }]}>Why does closer distance create stronger movement?</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Air slows down and spreads out as it travels further from the fan. At 15cm, the air stream is faster and more concentrated, creating more force on the paper. At 45cm, the same fan produces noticeably less movement.
              </Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.subTitle, { color: text }]}>Why do different fan designs create different airflow?</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Folded fans with more surface area push more air per stroke. Tighter folds create a focused stream of air. A flat, unfolded sheet pushes air but loses much of it to the sides rather than directing it forward.
              </Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.subTitle, { color: text }]}>How does material stiffness affect the bend angle?</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                Using F ≈ k · θ, for the same force, a lower k value (less stiff material) produces a larger θ (bigger bend). This is why thin paper bends dramatically while corrugated cardboard barely moves under the same fan.
              </Text>
            </SectionCard>

            <SectionCard>
              <Text style={[styles.subTitle, { color: text }]}>How does fan design influence air velocity and paper movement?</Text>
              <Text style={[styles.body, { color: mutedText }]}>
                A well-designed fan with multiple folds increases the effective surface area and directs airflow more efficiently. This increases the velocity of the air hitting the paper, producing greater force and a larger bend angle.
              </Text>
            </SectionCard>

            <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.replace('/(tabs)')} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  tab: { paddingHorizontal: Spacing.md, paddingVertical: 8, marginRight: 8 },
  tabText: { ...Typography.small, fontWeight: '600' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  activityTitle: { ...Typography.hero, fontSize: 24, marginBottom: 4 },
  activityTag: { ...Typography.small, fontWeight: '600', marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  subTitle: { ...Typography.section, fontSize: 14, marginBottom: Spacing.xs },
  body: { ...Typography.body, fontSize: 13, lineHeight: 20 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 22 },
  divider: { borderTopWidth: 1, marginBottom: Spacing.sm },
  question: { ...Typography.section, fontSize: 14, marginBottom: Spacing.xs },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, minHeight: 80, ...Typography.body, fontSize: 13, marginBottom: Spacing.sm },
  materialRow: { paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  materialName: { ...Typography.body, fontSize: 13, fontWeight: '600' },
  materialDetail: { ...Typography.small },
  materialNote: { ...Typography.small, fontWeight: '600' },
  diagram: { borderWidth: 1, borderRadius: Radius.lg, borderStyle: 'dashed', padding: Spacing.lg, alignItems: 'center' },
  diagramText: { ...Typography.body, fontSize: 13, textAlign: 'center', lineHeight: 22 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 8, paddingHorizontal: 4 },
  tableHeader: { borderRadius: Radius.md, marginBottom: 4 },
  tableHead: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  tableInput: { ...Typography.small, fontSize: 12, textAlign: 'center', padding: 4 },
});