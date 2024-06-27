/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react/react-in-jsx-scope */

import {StyleSheet, View, SafeAreaView} from 'react-native';
import MenuReactApiRTC from './src/MenuReactApiRTC';

import {library} from '@fortawesome/fontawesome-svg-core';
import {faSquareCheck} from '@fortawesome/free-solid-svg-icons/faSquareCheck';
import {faCloud} from '@fortawesome/free-solid-svg-icons/faCloud';
library.add(faSquareCheck, faCloud);

//Following lines are used to deactivate Hot reloading during app devlopment.
//This is done as hot reloading may result in bad application status in our case
import {NativeModules} from 'react-native';
if (__DEV__) {
  NativeModules.DevSettings.setHotLoadingEnabled(false);
}

export default function App() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={{width: '100%', height: '100%'}}>
        <MenuReactApiRTC />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    margin: 5,
    paddingLeft: 2,
    paddingRight: 2,
    fontSize: 20,
  },
});
