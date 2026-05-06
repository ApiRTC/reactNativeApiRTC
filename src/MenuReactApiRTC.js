/* eslint-disable react-native/no-inline-styles */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
} from 'react-native';

import ReactNativeApiRTC from './ReactNativeApiRTC';

import {setStatusBarBackgroundColor} from 'expo-status-bar';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1D1F20',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 160,
    height: 48,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e8eaed',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#c0cad5',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#0080FF',
    borderRadius: 12,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  versionText: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    color: '#8898a8',
  },
});

const initialState = {
  confMode: false,
};

export default class MenuReactApiRTC extends React.Component {
  constructor(props) {
    super(props);
    this.state = initialState;
  }

  componentDidMount() {}

  changeMode(mode, value) {
    if (mode === 'confMode') {
      if (Platform.OS === 'ios') {
        StatusBar.setBarStyle('dark-content');
      } else {
        setStatusBarBackgroundColor('blue');
      }
      this.setState({confMode: value});
    }
  }

  render() {
    if (this.state.confMode) {
      return <ReactNativeApiRTC />;
    }

    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Image
            source={{uri: 'https://apirtc.com/images/apiRTC-dark-e1540196351855.webp'}}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{' Welcome '}</Text>
          <Text style={styles.subtitle}>{'Select a demo to get started '}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.changeMode('confMode', true)}>
            <Text style={styles.buttonText}>{'ApiRTC Conversation '}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.versionText}>ApiRTC Demo</Text>
      </View>
    );
  }
}
