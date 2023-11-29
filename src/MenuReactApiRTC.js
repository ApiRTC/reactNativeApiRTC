/* eslint-disable react-native/no-inline-styles */

//import React, {Component} from 'react';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  StatusBar,
  Platform,
} from 'react-native';

import ReactNativeApiRTC from './ReactNativeApiRTC';

import LogRocket from '@logrocket/react-native';

import { setStatusBarBackgroundColor } from 'expo-status-bar';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'white',
  },
  picker: {},
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  input: {
    width: '80%',
    borderWidth: 1,
    padding: 5,
    marginBottom: 20,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 4,
    backgroundColor: '#1E90FF',
  },
  text: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 'bold',
    letterSpacing: 0.25,
    color: 'white',
  },
});

const initialState = {
  confMode: false,
  peerMode: false,
};

export default class MenuReactApiRTC extends React.Component {
  constructor(props) {
    super(props);
    this.state = initialState;
  }

  componentDidMount() {
    LogRocket.init('jof0xj/exampletest')

    LogRocket.identify('Savinien', {
      name: 'Savinien Barbotaud',
      email: 'savinien.barbotaud@apizee.com',
    });
  }

  changeMode(mode, value) {
    if (mode === 'confMode') {
      if (Platform.OS === 'ios') {
        StatusBar.setBarStyle('dark-content');
      } else {
        setStatusBarBackgroundColor('blue');
      }
      this.setState({ confMode: value });
    }
  }

  render() {
    function conference(ctx) {
      if (ctx.state.confMode !== true) {
        return null;
      }
      return <ReactNativeApiRTC />;
    }

    function menu(ctx) {
      if (ctx.state.confMode === true) {
        return null;
      }
      return (
        <View style={{ marginTop: 250, paddingHorizontal: 100 }}>
          <Text>Welcome, select the demo :</Text>
          <Pressable
            style={styles.button}
            onPress={() => ctx.changeMode('confMode', true)}>
            <Text style={styles.text}>Tuto : ApiRTC Conversation</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {menu(this)}
        {conference(this)}
      </View>
    );
  }
}
