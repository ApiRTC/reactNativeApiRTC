/* eslint-disable react-native/no-inline-styles */
/* globals apiRTC*/

import React from 'react';
import {
  Text,
  View,
  Button,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';

import {
  //RTCPeerConnection,
  //RTCIceCandidate,
  //RTCSessionDescription,
  RTCView,
  //MediaStream,
  //MediaStreamTrack,
  //mediaDevices,
  ScreenCapturePickerView,
} from 'react-native-webrtc';

import DeviceInfo from 'react-native-device-info';

import '@apirtc/react-native-apirtc';
//import apiCC from '@apirtc/apirtc';
//import apiRTC from '@apirtc/apirtc';

import ForegroundService from './ForegroundService';
import Chat_apiRTC from './Chat_apiRTC';
/*
                DRAG_AND_DROP :
                You can uncomment the following line to add possibility to drag and drop local video view.
*/
//import MovingViewWithPanResponder from './panSelfView';
import Svg_bubble_speech from '../assets/svg/Bubble-speech.js';
import {styles} from './Styles';

/* Import SVG */
import Microphone_on from '../assets/svg/Microphone_on.js';
import Microphone_off from '../assets/svg/Microphone_off.js';
import ScreenShare_on from '../assets/svg/ScreenShare_on.js';
import ScreenShare_off from '../assets/svg/ScreenShare_off.js';
import Camera_off from '../assets/svg/Camera_off.js';
import Camera_on from '../assets/svg/Camera_on.js';
import Hangup from '../assets/svg/Hangup.js';
import Menu from '../assets/svg/Menu.js';
import Switch_camera from '../assets/svg/Switch_camera.js';
import Camera_record from '../assets/svg/Camera_record.js';
//import Torche from '../assets/svg/LightBulb.js';

const initialState = {
  initStatus: 'Registration ongoing',
  info: '',
  status: 'pickConv',
  selfViewSrc: null,
  selfScreenSrc: null,
  remoteListSrc: new Map(),
  remoteList: new Map(),
  connectedUsersList: [],
  selected: null,
  callId: 0,
  roomName: 'defaultRoom',
  mute: false, // --| Use for mute state and switch state
  muteVideo: false, // --|
  chatOpen: false,
  screenUserValidated: false,
  screenDisableUserValidated: true,
  menuOpen: false,
  coordX: 0,
  coordY: 0,
  isRecording: false,
  remoteMenuOpen: false,
  remoteIdSelected: null,
  switch_screenShare: false,
  newMessage: null,
  cameraIsFront: true,
  timer: null,
};

export default class ReactNativeApiRTC extends React.Component {
  constructor(props) {
    super(props);
    console.log(DeviceInfo.getBundleId());
    this.state = initialState;
    this.ua = null;
    this.connectedSession = null;
    this.currentCall = null;
    this.conversation = null;
    this.localStream = null;
    this.localScreen = null;
    this.publishedLocalStream = null;
    this.publishedLocalScreen = null;
    this.chatChild = null;
    this.foreground = new ForegroundService();
  }

  componentDidMount() {
    //apiRTC.setLogLevel(10);

    this.setState({remoteListSrc: new Map(), remoteList: new Map()});

    this.ua = new apiRTC.UserAgent({
      /*
        Change "myDemoApiKey" with your own apiKey : Create your account on https://cloud.apirtc.com/register
      */
      uri: 'apzkey:myDemoApiKey',
    });

    var registerInformation = {};
    this.ua
      .register(registerInformation)
      .then(session => {
        this.connectedSession = session;
      })
      .catch(err => {
        console.error('Error on register : ', err);
      });

    /*
    Screen sharing is not yet avaialble on iOS
    */
    /*
    if (Platform.OS === 'ios') {
      this.screenCaptureView = createRef(null);
    }
    */
  }

  joinConversation() {
    this.setState({status: 'onCall'});
    this.conversation
      .join()
      .then(() => {
        console.info('Conversation join');
        this.setState({initStatus: 'Conversation join'});
        apiRTC.Stream.createStreamFromUserMedia()
          .then(localStream => {
            this.localStream = localStream;
            console.info('Update local stream');
            this.conversation
              .publish(localStream)
              .then(pubStream => {
                this.publishedLocalStream = pubStream;
                this.setState({selfViewSrc: localStream.getData().toURL()});
              })
              .catch(err => {
                console.error('Error publish stream :', err);
              });
          })
          .catch(err => {
            console.error('Error on createStreamFromUserMedia : ', err);
          });
      })
      .catch(err => {
        console.error('Error on join :', err);
      });
  }

  setListeners() {
    this.conversation.on('contactJoined', newContact => {
      console.info('REACT - Contact list change');
      let array_contact = this.state.connectedUsersList;
      array_contact.push(newContact.getUsername);
      this.setState({connectedUsersList: array_contact});
      this.setState({
        connectedUsersList: Object.values(this.state.connectedUsersList),
      });
    });

    this.conversation.on('streamAdded', remoteStream => {
      let remoteStream_rtcView = remoteStream.getData().toURL();

      //set remote stream map
      this.setState({
        remoteListSrc: this.state.remoteListSrc.set(
          remoteStream.getId(),
          remoteStream_rtcView,
        ),
      });
      this.setState({
        remoteList: this.state.remoteList.set(
          remoteStream.getId(),
          remoteStream,
        ),
      });
    });

    this.conversation.on('streamRemoved', stream => {
      let updateRemoteListSrc = new Map(this.state.remoteListSrc);
      updateRemoteListSrc.delete(stream.getId());
      this.setState({remoteListSrc: updateRemoteListSrc});

      let updateRemoteList = new Map(this.state.remoteList);
      updateRemoteList.delete(stream.getId());
      this.setState({remoteList: updateRemoteList});
    });

    this.conversation.on('streamListChanged', streamInfo => {
      if (
        streamInfo.listEventType === 'added' &&
        streamInfo.isRemote === true
      ) {
        this.conversation
          .subscribeToStream(streamInfo.streamId)
          .then(() =>
            console.info('Subscribe to stream : ' + streamInfo.streamId),
          )
          .catch(err => {
            console.error('Error on subscribe to stream :', err);
          });
        this.conversation.subscribeToStream(streamInfo.streamId);
      }
    });

    this.conversation.on('recordingAvailable', recordingInfo => {
      console.log('recordingInfo :', recordingInfo);
      console.log('recordingInfo.mediaURL :', recordingInfo.mediaURL);
    });

    this.conversation.on('contactLeft', contactLeft => {
      let toDelete = [];
      this.state.remoteList.forEach(stream => {
        if (contactLeft.getUsername() === stream.getContact().getUsername()) {
          toDelete.push(stream.getId());
        }
      });
      toDelete.forEach(streamId => {
        if (this.state.remoteListSrc.get(streamId)) {
          let updateRemoteListSrc = new Map(this.state.remoteListSrc);
          updateRemoteListSrc.delete(streamId);
          this.setState({remoteListSrc: updateRemoteListSrc});

          let updateRemoteList = new Map(this.state.remoteList);
          updateRemoteList.delete(streamId);
          this.setState({remoteList: updateRemoteList});
        }
      });
    });
  }

  call = () => {
    //on video call
    if (this.connectedSession) {
      this.ua.enableMeshRoomMode(true); //Activate Mesh room mode

      this.conversation = this.connectedSession.getOrCreateConversation(
        this.state.roomName,
        {
          meshModeEnabled: false,
          meshOnlyEnabled: false,
        },
      );
      this.setListeners();
      this.joinConversation();
    } else {
      console.error(
        'Session is not connected : check your network connection. Or an issue with Hot reload ? press R',
      );
    }
  };

  hangUp = () => {
    if (this.publishedLocalScreen) {
      this.conversation.unpublish(this.publishedLocalScreen);
    }
    if (this.publishedLocalStream) {
      this.conversation.unpublish(this.publishedLocalStream);
    }
    this.publishedLocalStream = null;
    this.publishedLocalScreen = null;
    this.localScreen = null;
    this.localStream = null;
    this.conversation.leave().then(() => {
      this.setState({
        selfScreenSrc: null,
        selfViewSrc: null,
        status: 'pickConv',
        remoteListSrc: new Map(),
        connectedUsersList: [],
      });
      this.conversation = null;
    });
  };

  screenSharing = () => {
    if (this.state.selfScreenSrc) {
      this.foreground.stopService();
      this.setState({selfScreenSrc: null});
      this.setState({switch_screenShare: false});
      this.setState({screenUserValidated: false});
      this.setState({screenDisableUserValidated: false});
      if (this.localScreen) {
        this.conversation.unpublish(this.localScreen);
      }
      this.localScreen = null;
    } else {
      if (Platform.OS === 'ios') {
        /*
        Screen sharing is not yet avaialble on iOS
        */
        /*
        const reactTag = findNodeHandle(this.screenCaptureView.current);
        NativeModules.ScreenCapturePickerViewManager.show(reactTag);

        const displayMediaStreamConstraints = {
          video: true,
          audio: false,
        };
        apiRTC.Stream.createScreensharingStream(displayMediaStreamConstraints)
          .then(localScreenShare => {
            this.localScreen = localScreenShare;
            this.setState({selfScreenSrc: this.localScreen.getData().toURL()});
            this.conversation
              .publish(localScreenShare)
              .then(publishedScreenShare => {
                this.publishedLocalScreen = publishedScreenShare;
                this.setState({switch_screenShare: true});
              })
              .catch(err => {
                console.error(err);
              });
          })
          .catch(err => {
            console.error(err);
          });
        */
      } else {
        this.foreground.startService(
          'Screen sharing',
          'is capturing your screen',
        );
        const displayMediaStreamConstraints = {
          video: true,
          audio: false,
        };
        apiRTC.Stream.createScreensharingStream(displayMediaStreamConstraints)
          .then(localScreenShare => {
            this.localScreen = localScreenShare;
            this.setState({selfScreenSrc: this.localScreen.getData().toURL()});
            this.conversation
              .publish(localScreenShare)
              .then(publishedScreenShare => {
                this.publishedLocalScreen = publishedScreenShare;
                this.setState({switch_screenShare: true});
              })
              .catch(err => {
                console.error('Error on publish stream for screenShare :', err);
              });
          })
          .catch(err => {
            console.error('Error on createScreensharingStream :', err);
          });
      }
    }
  };

  mute = () => {
    if (this.state.mute === false) {
      console.info('Mute');
      this.publishedLocalStream.disableAudio();
      this.setState({mute: true});
    } else {
      console.info('Unmute');
      this.publishedLocalStream.enableAudio();
      this.setState({mute: false});
    }
  };

  muteVideo = () => {
    if (this.state.muteVideo === false) {
      console.info('MuteVideo');
      this.publishedLocalStream.disableVideo();
      this.setState({muteVideo: true});
    } else {
      console.info('UnmuteVideo');
      this.publishedLocalStream.enableVideo();
      this.setState({muteVideo: false});
    }
  };

  chatOpen() {
    if (this.state.chatOpen === false) {
      console.info('Open chat');
      this.setState({chatOpen: true});
    } else {
      console.info('Close chat');
      this.setState({chatOpen: false});
    }
  }

  changeSelfViewPosition(evt) {
    let coordX = evt.nativeEvent.locationX;
    let coordY = evt.nativeEvent.locationY;
    this.setState({coordX: coordX});
    this.setState({coordY: coordY});
    console.log(`x coord = ${evt.nativeEvent.locationX}`);
    console.log(`y coord = ${evt.nativeEvent.locationY}`);
  }

  screenOK() {
    if (this.state.screenUserValidated === false) {
      this.setState({screenUserValidated: true});
    } else {
      this.setState({screenUserValidated: false});
    }
  }

  screenDisableOK() {
    if (this.state.screenDisableUserValidated === false) {
      this.setState({screenDisableUserValidated: true});
    } else {
      this.setState({screenDisableUnscreenDisableUserValidatedderStood: false});
    }
  }

  menu() {
    if (this.state.menuOpen === false) {
      this.setState({menuOpen: true});
    } else {
      this.setState({menuOpen: false});
    }
  }

  switchCamera() {
    this.localStream
      .getData()
      .getVideoTracks()
      .forEach(track => {
        track._switchCamera();
      });
  }

  recordingManager() {
    if (this.state.isRecording === false) {
      this.setState({isRecording: true});
      console.info('startCompositeRecording');

      this.conversation
        .startRecording()
        .then(recordingInfo => {
          console.info('startRecording', recordingInfo);
          console.info('startRecording mediaURL', recordingInfo.mediaURL);
        })
        .catch(e => {
          console.error('Error while start recording : ', e);
        });
    } else {
      this.setState({isRecording: false});
      console.info('stopCompositeRecording');

      this.conversation
        .stopRecording()
        .then(recordingInfo => {
          console.info('stopRecording', recordingInfo);
        })
        .catch(e => {
          console.error('Error while start recording : ', e);
        });
    }
  }

  menuOptionRemote(index = null, value = null, evt = null) {
    if (this.state.remoteMenuOpen) {
      //Menu is open
      console.info('Close remote menu');
      this.setState({remoteIdSelected: null});
      this.setState({remoteMenuOpen: false});
    } else {
      console.info('Open remote menu');
      console.info('Index : ' + index + ' / Value : ' + value);
      let key = this.getByValue(this.state.remoteListSrc, value);
      this.setState({remoteIdSelected: key});
      this.setState({remoteMenuOpen: true});
    }
  }

  /*
    This function can not be used for now as applyConstraints() is not yet supported on react-native-webrtc
  */
  /*
  remoteTorche() {
    console.info('Set torche for stream : ' + this.state.remoteIdSelected);
    let constraintToApply = {
      audio: {},
      video: {
        advanced: [
          {
            torch: true,
          },
        ],
      },
    };
    let stream_torch = this.state.remoteList.get(this.state.remoteIdSelected);
    stream_torch
      .applyConstraints(constraintToApply)
      .then(() => {
        console.info('Updated');
      })
      .catch(function (error) {
        console.log('Error : ', error);
      });
  }
  */

  render() {
    function setRoom(ctx, value) {
      ctx.state.roomName = value;
    }

    function renderPicker(ctx) {
      if (ctx.state.status !== 'pickConv') {
        return null;
      }
      return (
        <View style={{paddingHorizontal: 20, marginTop: 150}}>
          <Text>
            {'Welcome on reactNativeApiRTC Conference demo :'}
            {'\n'}
            {'\n'}
          </Text>
          <TextInput
            onChangeText={val => setRoom(ctx, val)}
            style={styles.input}
            placeholder={'Enter your Conference name'}
          />
          <Button
            onPress={ctx.call}
            title="Join Conference"
            color="#0080FF"
            accessibilityLabel="Join Conference"
          />
        </View>
      );
    }

    function renderSelfView(ctx) {
      if (ctx.state.status !== 'onCall') {
        return null;
      }
      return (
        /*
        DRAG_AND_DROP :
        You can uncomment the following line to add possibility to drag and drop local video view.
        And comment line starting with <RTCView ...
        */
        //<MovingViewWithPanResponder selfViewSrc={ctx.state.selfViewSrc} />
        <RTCView
          style={styles.selfViewLocal}
          streamURL={ctx.state.selfViewSrc}
        />
      );
    }

    function renderScreenSelfView(ctx) {
      if (ctx.state.status !== 'onCall' || ctx.state.selfScreenSrc === null) {
        return null;
      }
      return (
        <RTCView
          style={styles.selfScreenView}
          streamURL={ctx.state.selfScreenSrc}
        />
      );
    }

    function screenCaptureInfoStart(ctx) {
      if (
        ctx.state.status !== 'onCall' ||
        ctx.state.selfScreenSrc === null ||
        ctx.state.screenUserValidated === true
      ) {
        return null;
      }
      return (
        <View style={styles.screenCaptureInformation}>
          <View style={styles.screenCaptureContainer}>
            <Text>You are sharing your screen !</Text>
            <Pressable
              style={styles.screenCaptureButton}
              onPress={() => ctx.screenOK()}
              title="Screen Capture understood">
              <Text>OK</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    function screenCaptureInfoStop(ctx) {
      if (
        ctx.state.status !== 'onCall' ||
        ctx.state.screenDisableUserValidated === true
      ) {
        return null;
      }
      return (
        <View style={styles.screenCaptureInformation}>
          <View style={styles.screenCaptureContainer}>
            <Text>Screen sharing has been stopped</Text>
            <Pressable
              style={styles.screenCaptureButton}
              onPress={() => ctx.screenDisableOK()}
              title="Screen Capture disable understood">
              <Text>OK</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    function renderRemoteViews(ctx) {
      if (ctx.state.status !== 'onCall') {
        return null;
      }
      return (
        <View style={styles.remoteContainer}>
          <ScrollView style={[styles.scollView, {flexGrow: 1}]}>
            <View style={styles.remoteContainerFlex}>
              {renderRemoteView(ctx)}
            </View>
          </ScrollView>
        </View>
      );
    }

    function renderRemoteView(ctx) {
      if (ctx.state.remoteListSrc.size === 0) {
        return null;
      }
      return Array.from(ctx.state.remoteListSrc.values()).map(
        (value, index) => (
          <TouchableOpacity
            key={index}
            style={styles.remoteView}
            onLongPress={evt => ctx.menuOptionRemote(index, value, evt)}>
            <RTCView
              streamURL={value}
              style={{width: '100%', height: '100%'}}
            />
          </TouchableOpacity>
        ),
      );
    }

    function renderButtons(ctx) {
      if (ctx.state.status !== 'onCall') {
        return null;
      }
      return (
        <View style={styles.renderButton}>
          <TouchableOpacity
            style={[
              styles.renderButtonComponent,
              {
                backgroundColor: '#1D1F20',
                borderColor: '#313335',
                borderWidth: 2,
              },
            ]}
            onPress={() => {
              ctx.menu();
            }}>
            <View style={styles.svgButton}>
              <Menu />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.renderButtonComponent}
            onPress={() => {
              ctx.mute();
            }}>
            <View style={styles.svgButton}>{renderMuteButton(ctx)}</View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.renderButtonComponent}
            onPress={() => {
              ctx.muteVideo();
            }}>
            <View style={styles.svgButton}>{renderMuteVideoButton(ctx)}</View>
          </TouchableOpacity>
          {dipslayScreenShare(ctx)}
          <TouchableOpacity
            style={styles.renderButtonComponent}
            onPress={() => {
              ctx.chatOpen();
            }}>
            <View style={styles.svgButton}>
              <Svg_bubble_speech />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.renderButtonComponent, {backgroundColor: '#FF6056'}]}
            onPress={() => {
              ctx.hangUp();
            }}>
            <View style={styles.svgButton}>
              <Hangup />
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    function dipslayScreenShare(ctx) {
      if (Platform.OS === 'ios') {
        return null;
      }
      return (
        <TouchableOpacity
          style={styles.renderButtonComponent}
          onPress={() => {
            ctx.screenSharing();
          }}>
          <View style={styles.svgButton}>{renderScreenSharingButton(ctx)}</View>
        </TouchableOpacity>
      );
    }

    function renderMuteButton(ctx) {
      if (ctx.state.mute === false) {
        return <Microphone_on />;
      }
      return <Microphone_off />;
    }

    function renderMuteVideoButton(ctx) {
      if (ctx.state.muteVideo === false) {
        return <Camera_on />;
      }
      return <Camera_off />;
    }

    function renderScreenSharingButton(ctx) {
      if (ctx.state.selfScreenSrc) {
        return <ScreenShare_on />;
      }
      return <ScreenShare_off />;
    }

    function chat(ctx) {
      if (ctx.state.status !== 'onCall' && ctx.state.chatOpen !== true) {
        return null;
      }
      return (
        <Chat_apiRTC
          chatOpen={ctx.state.chatOpen}
          conversation={ctx.conversation}
          session={ctx.connectedSession}
          message={ctx.state.newMessage}
          ref={instance => {
            this.chatChild = instance;
          }}
        />
      );
    }

    function renderDialog(ctx) {
      if (ctx.state.status !== 'onCall' || ctx.state.menuOpen !== true) {
        return null;
      }
      return (
        <View style={styles.dialogContainer}>
          <View style={styles.dialogBox}>
            {/*If you need to add a element to the menu*/}
            {/*Just copy paste TouchableOpacity element*/}
            <TouchableOpacity
              onPress={() => {
                ctx.switchCamera();
              }}
              style={styles.touchDialog}>
              <View style={styles.contentDialogCountainer}>
                <View style={styles.svgDialog}>
                  <Switch_camera />
                </View>
                <View style={styles.testDialog}>
                  <Text style={{color: '#BBCCDD'}}>Switch camera</Text>
                </View>
              </View>
            </TouchableOpacity>
            {/*End here*/}
            <TouchableOpacity
              onPress={() => {
                ctx.recordingManager();
              }}
              style={styles.touchDialog}>
              <View style={styles.contentDialogCountainer}>
                <View style={styles.svgDialog}>
                  <Camera_record />
                </View>
                <View style={styles.testDialog}>{recordText(ctx)}</View>
              </View>
            </TouchableOpacity>
            {/*End here*/}
          </View>
        </View>
      );
    }

    function recordText(ctx) {
      if (ctx.state.isRecording) {
        return <Text style={{color: '#BBCCDD'}}>Stop recording</Text>;
      }
      return <Text style={{color: '#BBCCDD'}}>Start recording</Text>;
    }

    /*
    This function is not used in this version
    */
    function menuOptionRemote(ctx) {
      if (!ctx.state.remoteMenuOpen) {
        return null;
      }
      return (
        <TouchableOpacity
          onPress={() => ctx.menuOptionRemote()}
          style={styles.behindMenuRemoteContainer}>
          <View style={[styles.menuRemoteContainer]}>
            {/*If you need to add a element to the menu*/}
            {/*Just copy paste TouchableOpacity element*/}
            {/*
            <TouchableOpacity
              onPress={() => ctx.remoteTorche()}
              style={styles.touchDialog}>
              <View style={styles.contentDialogCountainer}>
                <View style={styles.svgDialog}>
                  <Torche />
                </View>
                <View style={styles.testDialog}>
                  <Text style={{color: '#BBCCDD'}}>Swich on remote torch</Text>
                </View>
              </View>
            </TouchableOpacity>
            */}
            <TouchableOpacity style={styles.touchDialog}>
              <View style={styles.contentDialogCountainer}>
                <View style={styles.testDialog}>
                  <Text style={{color: '#BBCCDD'}}>Remote Control menu</Text>
                </View>
              </View>
            </TouchableOpacity>
            {/*End here*/}
          </View>
        </TouchableOpacity>
      );
    }

    function screenCapturePickerView(ctx) {
      if (Platform.OS !== 'ios') {
        return null;
      }
      return <ScreenCapturePickerView ref={ctx.screenCaptureView} />;
    }

    return (
      <View style={styles.container}>
        {screenCapturePickerView(this)}
        {menuOptionRemote(this)}
        {renderPicker(this)}
        {renderRemoteViews(this)}
        {renderButtons(this)}
        {renderDialog(this)}
        {renderSelfView(this)}
        {renderScreenSelfView(this)}
        {chat(this)}
        {screenCaptureInfoStart(this)}
        {screenCaptureInfoStop(this)}
      </View>
    );
  }

  getByValue(map, searchValue) {
    for (let [key, value] of map.entries()) {
      if (value === searchValue) {
        return key;
      }
    }
  }
}
