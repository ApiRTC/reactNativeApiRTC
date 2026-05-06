/* eslint-disable react-native/no-inline-styles */
import Svg, {Path} from 'react-native-svg';

import React from 'react';
import {View} from 'react-native';

export default class Chevron_up extends React.Component {
  render() {
    return (
      <View style={{width: '100%', height: '100%'}}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <Path
            d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"
            fill="#FFFFFF"
          />
        </Svg>
      </View>
    );
  }
}
