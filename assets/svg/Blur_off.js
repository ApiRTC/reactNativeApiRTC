/* eslint-disable react-native/no-inline-styles */
import Svg, {Circle, Line, Path} from 'react-native-svg';

import React from 'react';
import {View} from 'react-native';

export default class Blur_off extends React.Component {
  render() {
    return (
      <View style={{width: '100%', height: '100%'}}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <Circle cx="12" cy="8" r="3" fill="#000000" />
          <Path d="M6 21v-1a6 6 0 0 1 12 0v1" fill="#000000" />
          <Line
            x1="3"
            y1="3"
            x2="21"
            y2="21"
            stroke="#000000"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }
}
