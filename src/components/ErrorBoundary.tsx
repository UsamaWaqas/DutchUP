import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Deliberately independent of the theme/i18n providers and the custom Text/Button
 * components — if one of those is what crashed, this fallback must still render.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>DutchUp ran into an unexpected problem. You can try again — if it keeps happening, close and reopen the app.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={this.reset} style={({ pressed }) => [styles.button, pressed ? { opacity: 0.85 } : null]}>
              <Text style={styles.buttonLabel}>Try again</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF6EE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    gap: 10,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(74,42,20,0.12)',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#2B1A0E',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B5B4A',
  },
  button: {
    marginTop: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4A2A14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F6F3EA',
  },
});
