/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react/react-in-jsx-scope */

import {StyleSheet, View, SafeAreaView} from 'react-native';
import MenuReactApiRTC from './src/MenuReactApiRTC';

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
