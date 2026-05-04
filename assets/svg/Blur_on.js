/* eslint-disable react-native/no-inline-styles */
import Svg, {Circle, Path, Rect} from 'react-native-svg';

import React from 'react';
import {View} from 'react-native';

export default class Blur_on extends React.Component {
  render() {
    return (
      <View style={{width: '100%', height: '100%'}}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <Rect
            x="1"
            y="1"
            width="22"
            height="22"
            rx="2"
            stroke="#000000"
            strokeWidth="1.5"
          />
          <Circle cx="3.5" cy="3.5" r="2" fill="#000000" opacity="0.15" />
          <Circle cx="4" cy="5" r="0.9" fill="#000000" opacity="0.35" />
          <Circle cx="20.5" cy="3.5" r="1.8" fill="#000000" opacity="0.12" />
          <Circle cx="20" cy="5.5" r="0.7" fill="#000000" opacity="0.40" />
          <Circle cx="2.5" cy="19.5" r="1.5" fill="#000000" opacity="0.18" />
          <Circle cx="4.5" cy="21.5" r="0.8" fill="#000000" opacity="0.30" />
          <Circle cx="21" cy="20" r="1.6" fill="#000000" opacity="0.13" />
          <Circle cx="20" cy="22" r="0.7" fill="#000000" opacity="0.38" />
          <Circle cx="2" cy="12" r="1.0" fill="#000000" opacity="0.20" />
          <Circle cx="22" cy="12" r="1.0" fill="#000000" opacity="0.20" />
          <Circle cx="12" cy="8" r="3" fill="#000000" />
          <Path d="M6 21v-1a6 6 0 0 1 12 0v1" fill="#000000" />
        </Svg>
      </View>
    );
  }
}
