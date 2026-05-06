/* eslint-disable react-native/no-inline-styles */
/* globals apiRTC*/

import React, {createRef} from 'react';
import {
  Text,
  View,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Platform,
  findNodeHandle,
  NativeModules,
  Image,
  StyleSheet,
  NativeEventEmitter,
} from 'react-native';

const {AppLifecycleModule} = NativeModules;
const {BackgroundBlurModule} = NativeModules;

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

import AsyncStorage from '@react-native-async-storage/async-storage';

import Chat_apiRTC from './Chat_apiRTC';
import ReactNativeApiRTC_RPK from './ReactNativeApiRTC_RPK'; //This is to manage interaction with screen sharing extension on iOS

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
import Blur_on from '../assets/svg/Blur_on.js';
import Chevron_up from '../assets/svg/Chevron_up.js';
//import Torche from '../assets/svg/LightBulb.js';

const BACKGROUNDS = [
  {id: 'none', label: 'Aucun', type: 'none', thumbUri: null},
  {id: 'blur', label: 'Flou', type: 'blur', strong: false, thumbUri: null},
  {
    id: 'blur-strong',
    label: 'Flou+',
    type: 'blur',
    strong: true,
    thumbUri: null,
  },
  {
    id: 'beach',
    label: 'Plage',
    type: 'image',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280',
    thumbUri:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=120&q=60',
  },
  {
    id: 'mountains',
    label: 'Montagne',
    type: 'image',
    imageUrl:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280',
    thumbUri:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&q=60',
  },
  {
    id: 'office',
    label: 'Bureau',
    type: 'image',
    imageUrl:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280',
    thumbUri:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=120&q=60',
  },
];

//Ignore all log notifications:
//You can hide JavaScript console logs by calling LogBox.ignoreAllLogs() before rendering your app.
//import {LogBox} from 'react-native';
//LogBox.ignoreAllLogs();

const initialState = {
  initStatus: 'Registration ongoing',
  info: '',
  connected: 'notconnected',
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
  selectedBgEffect: 'none', // 'none' | 'blur' | image bg id — Android only
  videoEffectPanel: false, // whether the video effect panel is open
  isApplyingBg: false, // download/apply in progress
  chatOpen: false,
  displayScreenInfoStop: false,
  menuOpen: false,
  coordX: 0,
  coordY: 0,
  isRecording: false,
  remoteMenuOpen: false,
  remoteIdSelected: null,
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
    this.chatChild = null;
    this.screenSharingIsStarted = false; //Boolean to know if screen sharing is started
    this.localStreamIsPublished = false; //Boolean to know if local stream is published
    this.localScreenIsPublished = false; //Boolean to know if local screen is published
  }

  componentDidMount() {
    //apiRTC.setLogLevel(10);

    //Process to handle app destroy event
    //This will be called when the app is destroyed (when the user closes the app)
    //This is done by the AppLifecycleModule which is a native module that listens to app lifecycle events
    //and sends an event to the JavaScript side when the app is destroyed
    //This is useful to stop screen sharing (and extension) if it is started

    if (Platform.OS === 'android') {
      const eventEmitter = new NativeEventEmitter();
      eventEmitter.addListener('liveCycleEvent', event => {
        console.debug('liveCycleEvent :', event.eventType);
        if (event.eventType === 'onDestroy') {
          //App destroy event received from AppLifecycleModule

          //Note : This event is not always received when the app is closed
          //liveCycleEvent Module will also call mediaStreamRelease on WebRTCModule
          //to release the local stream and the screen sharing stream
          //But we also call hangUp() here to try unpublish the streams
          this.hangUp();
        } else {
          console.debug('liveCycleEvent not managed :', event.eventType);
        }
      });
    }

    if (Platform.OS === 'android') {
      AsyncStorage.getItem('videoEffect')
        .then(saved => {
          if (saved && saved !== 'none') {
            this.setState({selectedBgEffect: saved});
          }
        })
        .catch(() => {});
    }

    this.setState({remoteListSrc: new Map(), remoteList: new Map()});

    this.ua = new apiRTC.UserAgent({
      /*
        Change "myDemoApiKey" with your own apiKey : Create your account on https://cloud.apirtc.com/register
      */
      uri: 'apzkey:myDemoApiKey',
    });

    this.setUAListeners();

    var registerInformation = {};
    this.ua
      .register(registerInformation)
      .then(session => {
        this.connectedSession = session;
        this.setState({connected: 'connected'}); //This will enable render to display correct connexion status
      })
      .catch(err => {
        console.error('Error on register : ', err);
      });

    if (Platform.OS === 'ios') {
      this.screenCaptureView = createRef(null);
    }
  }

  setUAListeners() {
    this.ua.on('ccsConnectionStatus', event => {
      console.debug('ccsConnectionStatus : ', event);
      switch (event.status) {
        case 'connected':
          console.debug('connected : ', event);
          this.setState({connected: 'connected'}); //This will enable render to display correct connexion status
          break;
        case 'retry':
          console.debug('reconnecting : ', event);
          this.setState({connected: 'reconnecting'}); //This will enable render to display correct connexion status
          break;
        case 'disconnected':
          console.debug('disconnect : ', event);
          this.setState({connected: 'disconnect'}); //This will enable render to display correct connexion status
          break;
        case 'error':
          console.debug('error : ', event);
          this.setState({connected: 'disconnect'}); //This will enable render to display correct connexion status
          break;
        default:
          console.log(
            'ccsConnectionStatus not managed case for :',
            event.status,
          );
      }
    });
  }

  joinConversation() {
    this.conversation
      .join()
      .then(() => {
        console.info('Conversation join');
        this.setState({status: 'onCall'});
        this.setState({initStatus: 'Conversation join'});
        apiRTC.Stream.createStreamFromUserMedia()
          .then(localStream => {
            this.localStream = localStream;
            console.info('Update local stream');
            if (Platform.OS === 'android') {
              this.restoreVideoEffect();
            }

            console.debug('localStream created :', this.localStream);
            console.debug(
              'localStream._reactTag :',
              this.localStream.data._reactTag,
            );
            console.debug(
              'localStream._tracks[0].id :',
              this.localStream.data._tracks[0].id,
            );

            if (Platform.OS === 'android') {
              //Sending localStream data to AppLifecycleModule
              //This is to enable AppLifecycleModule to stop screen sharing extension when the app is destroyed
              let paramForAppLifecycleModule = {
                localStreamReactTag: this.localStream.data._reactTag,
                localStreamTrackId: this.localStream.data._tracks[0].id,
              };
              AppLifecycleModule.sendInfoToAppLifecycleModule(
                paramForAppLifecycleModule,
              );
            }

            this.conversation
              .publish(localStream)
              .then(pubStream => {
                this.localStreamIsPublished = true;
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

  setConversationListeners() {
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
      this.conversation = this.connectedSession.getOrCreateConversation(
        this.state.roomName,
      );
      this.setConversationListeners();
      this.joinConversation();
    } else {
      console.error(
        'Session is not connected : check your network connection. Or an issue with Hot reload ? press R',
      );
    }
  };

  toggleVideoEffectPanel = () => {
    this.setState(prev => ({videoEffectPanel: !prev.videoEffectPanel}));
  };

  saveVideoEffectPreference = effectId => {
    AsyncStorage.setItem('videoEffect', effectId).catch(() => {});
  };

  restoreVideoEffect = async () => {
    const effectId = this.state.selectedBgEffect;
    if (effectId === 'none' || !this.localStream) {
      return;
    }
    const bg = BACKGROUNDS.find(b => b.id === effectId);
    if (!bg || bg.type === 'none') {
      return;
    }
    try {
      const videoTrack = this.localStream.data._tracks.find(
        t => t.kind === 'video',
      );
      if (!videoTrack) {
        return;
      }
      if (bg.type === 'blur') {
        await BackgroundBlurModule.enableBlur({
          streamReactTag: this.localStream.data._reactTag,
          trackId: videoTrack.id,
          strong: bg.strong === true,
        });
      } else if (bg.type === 'image') {
        await BackgroundBlurModule.enableBackgroundImage({
          streamReactTag: this.localStream.data._reactTag,
          trackId: videoTrack.id,
          imageUrl: bg.imageUrl,
        });
      }
    } catch (err) {
      console.error('Error restoring video effect:', err);
    }
  };

  applyVideoEffect = async bg => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (this.state.isApplyingBg) {
      return;
    }

    // Save preference and update UI immediately (works even before joining)
    this.saveVideoEffectPreference(bg.id);
    this.setState({selectedBgEffect: bg.id});

    if (!this.localStream) {
      // No active stream — preference saved, close panel
      this.setState({videoEffectPanel: false});
      return;
    }

    this.setState({isApplyingBg: true});

    try {
      if (bg.type === 'none') {
        await BackgroundBlurModule.disableBlur();
      } else if (bg.type === 'blur') {
        const videoTrack = this.localStream.data._tracks.find(
          t => t.kind === 'video',
        );
        if (!videoTrack) {
          console.error('applyVideoEffect: no video track found');
          return;
        }
        await BackgroundBlurModule.enableBlur({
          streamReactTag: this.localStream.data._reactTag,
          trackId: videoTrack.id,
          strong: bg.strong === true,
        });
      } else if (bg.type === 'image') {
        const videoTrack = this.localStream.data._tracks.find(
          t => t.kind === 'video',
        );
        if (!videoTrack) {
          console.error('applyVideoEffect: no video track found');
          return;
        }
        await BackgroundBlurModule.enableBackgroundImage({
          streamReactTag: this.localStream.data._reactTag,
          trackId: videoTrack.id,
          imageUrl: bg.imageUrl,
        });
      }
    } catch (err) {
      console.error('Error applying video effect:', err);
    } finally {
      this.setState({isApplyingBg: false, videoEffectPanel: false});
    }
  };

  hangUp = () => {
    if (this.state.selectedBgEffect !== 'none' && Platform.OS === 'android') {
      try {
        BackgroundBlurModule.disableBlur();
      } catch (e) {
        console.warn('Error disabling video effect during hangUp:', e);
      }
      // Keep selectedBgEffect in state — will be auto-applied on next join
      this.setState({videoEffectPanel: false});
    }

    if (this.localStream && this.localStreamIsPublished) {
      if (this.conversation) {
        this.conversation.unpublish(this.localStream);
      }
      this.localStreamIsPublished = false;
    }
    if (this.localStream) {
      this.localStream.release();
      this.localStream = null;
    }

    if (Platform.OS === 'android') {
      //ReInit localStream data in AppLifecycleModule
      let paramForAppLifecycleModule = {
        localStreamReactTag: 'STOPPED',
        localStreamTrackId: 'STOPPED',
      };
      AppLifecycleModule.sendInfoToAppLifecycleModule(
        paramForAppLifecycleModule,
      );
    }

    //Stop screen sharing
    if (Platform.OS === 'ios') {
      //Sending stop screen sharing request to the extension
      ReactNativeApiRTC_RPK.sendBroadcastNeedToBeStopped();
    }

    //Managing stop screen sharing on the application
    if (this.screenSharingIsStarted) {
      this.stopScreenSharingProcess();
      this.localScreen = null;
    }

    if (this.conversation) {
      this.conversation
        .leave()
        .then(() => {
          this.cleanConversationContext();
        })
        .catch(err => {
          console.error('Error on leave conversation :', err);
          this.cleanConversationContext();
        });
    }
  };

  cleanConversationContext = () => {
    this.setState({
      selfScreenSrc: null,
      status: 'pickConv',
      remoteListSrc: new Map(),
      connectedUsersList: [],
    });
    this.conversation.destroy();
    this.conversation = null;
  };

  stopScreenSharingProcess = () => {
    //Stop screen sharing
    this.setState({selfScreenSrc: null});
    this.setState({displayScreenInfoStop: true});
    if (
      this.localScreen &&
      this.localScreen !== null &&
      this.localScreenIsPublished
    ) {
      this.conversation.unpublish(this.localScreen);
      this.localScreenIsPublished = false;
    }
    if (Platform.OS === 'android') {
      this.localScreen.release();

      //ReInit localScreen data in AppLifecycleModule
      let paramForAppLifecycleModule = {
        localScreenReactTag: 'STOPPED',
        localScreenTrackId: 'STOPPED',
      };
      AppLifecycleModule.sendInfoToAppLifecycleModule(
        paramForAppLifecycleModule,
      );
    }
    this.localScreen = null;
    this.screenSharingIsStarted = false;
  };

  stoppedEventListenerOnScreenStream = () => {
    console.debug('Screen sharing stream has been stopped');
    this.stopScreenSharingProcess();
  };

  screenSharing = () => {
    if (this.screenSharingIsStarted) {
      //Stop screen sharing

      if (Platform.OS === 'ios') {
        //Sending stop screen sharing request to the extension
        ReactNativeApiRTC_RPK.sendBroadcastNeedToBeStopped();
      }

      //Managing stop screen sharing on the application
      this.stopScreenSharingProcess();
    } else {
      //Start screen sharing
      if (Platform.OS === 'ios') {
        const reactTag = findNodeHandle(this.screenCaptureView.current);
        NativeModules.ScreenCapturePickerViewManager.show(reactTag);

        const displayMediaStreamConstraints = {
          video: true,
          audio: false,
        };

        //Add listener for screen sharing event coming from the extension
        ReactNativeApiRTC_RPK.addListener('onScreenShare', event => {
          if (event === 'START_BROADCAST') {
            console.debug('Broadcast started');
            //Broadcast is started on extension side
            //We can publish the screen sharing stream to the conversation
            this.conversation
              .publish(this.localScreen)
              .then(publishedScreenShare => {
                this.localScreenIsPublished = true;
              })
              .catch(err => {
                console.error(err);
              });
          } else if (event === 'STOP_BROADCAST') {
            console.debug('Broadcast stopped');
          }
        });

        apiRTC.Stream.createScreensharingStream(displayMediaStreamConstraints)
          .then(localScreenShare => {
            this.screenSharingIsStarted = true;
            this.localScreen = localScreenShare;
            this.setState({selfScreenSrc: this.localScreen.getData().toURL()});

            //Adding listener for screen sharing stop event
            this.localScreen.on(
              'stopped',
              this.stoppedEventListenerOnScreenStream,
            );
          })
          .catch(err => {
            console.error(err);
          });
      } else {
        //Android : create screen sharing stream
        const displayMediaStreamConstraints = {
          video: true,
          audio: false,
        };
        apiRTC.Stream.createScreensharingStream(displayMediaStreamConstraints)
          .then(localScreenShare => {
            this.screenSharingIsStarted = true;
            this.localScreen = localScreenShare;

            console.debug('localScreen created :', this.localScreen);
            console.debug(
              'localScreen._reactTag :',
              this.localScreen.data._reactTag,
            );
            console.debug(
              'localScreen._reactTag :',
              this.localScreen.data._tracks[0].id,
            );

            //Sending localScreen data to AppLifecycleModule
            //This is to enable AppLifecycleModule to stop screen sharing extension when the app is destroyed
            let paramForAppLifecycleModule = {
              localScreenReactTag: this.localScreen.data._reactTag,
              localScreenTrackId: this.localScreen.data._tracks[0].id,
            };
            AppLifecycleModule.sendInfoToAppLifecycleModule(
              paramForAppLifecycleModule,
            );

            this.setState({selfScreenSrc: this.localScreen.getData().toURL()});
            this.conversation
              .publish(localScreenShare)
              .then(publishedScreenShare => {
                this.localScreenIsPublished = true;
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
      this.localStream.disableAudio();
      this.setState({mute: true});
    } else {
      console.info('Unmute');
      this.localStream.enableAudio();
      this.setState({mute: false});
    }
  };

  muteVideo = () => {
    if (this.state.muteVideo === false) {
      console.info('MuteVideo');
      this.localStream.disableVideo();
      this.setState({muteVideo: true});
    } else {
      console.info('UnmuteVideo');
      this.localStream.enableVideo();
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

  screenDisableOK() {
    this.setState({displayScreenInfoStop: false});
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

    function renderApiRTCCnx(ctx) {
      if (ctx.state.status !== 'pickConv') {
        return null;
      }
      const isConnected = ctx.state.connected === 'connected';
      const isReconnecting = ctx.state.connected === 'reconnecting';
      const dotColor = isConnected
        ? '#34a853'
        : isReconnecting
        ? '#fbbc04'
        : '#ea4335';
      const label = isConnected
        ? 'Connected '
        : isReconnecting
        ? 'Reconnecting… '
        : 'Disconnected ';
      return (
        <View style={styles.cnxBadgeOuter}>
          <View style={styles.cnxBadge}>
            <View style={[styles.cnxDot, {backgroundColor: dotColor}]} />
          </View>
          <Text style={styles.cnxLabel}>{label}</Text>
        </View>
      );
    }

    function renderWelcomeText(ctx) {
      if (ctx.state.status !== 'pickConv') {
        return null;
      }
      return (
        <View style={styles.welcomeBlock}>
          <Text style={styles.welcomeTitle}>Conference Demo</Text>
          <Text style={styles.welcomeSubtitle}>Powered by ApiRTC</Text>
          <Image
            source={{
              uri: 'https://apirtc.com/images/apiRTC-dark-e1540196351855.webp',
            }}
            style={styles.apiRtcLogo}
            resizeMode="contain"
          />
        </View>
      );
    }

    function renderPicker(ctx) {
      if (ctx.state.status !== 'pickConv') {
        return null;
      }
      return (
        <View style={styles.joinRow}>
          <TextInput
            onChangeText={val => setRoom(ctx, val)}
            style={styles.joinInput}
            placeholder="Conference name"
            placeholderTextColor="#8a9bb0"
          />
          <TouchableOpacity style={styles.joinBtn} onPress={ctx.call}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      );
    }

    function renderFooter(ctx) {
      if (ctx.state.status !== 'pickConv') {
        return null;
      }
      return (
        <Text style={styles.versionText}>{'ApiRTC ' + apiRTC.version}</Text>
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
          zOrder={1}
        />
      );
    }

    function renderScreenSelfView(ctx) {
      if (ctx.state.status !== 'onCall' || ctx.state.selfScreenSrc === null) {
        return null;
      }
      if (Platform.OS === 'ios') {
        //We can't display screen sharing stream locally on iOS : replacing stream by an image
        return (
          <Image
            style={styles.selfScreenViewImg}
            source={require('./images/screenSharingOngoing.png')}
          />
        );
      } else {
        //Android : display screen sharing stream locally
        return (
          <RTCView
            style={styles.selfScreenView}
            streamURL={ctx.state.selfScreenSrc}
          />
        );
      }
    }

    function screenCaptureInfoStop(ctx) {
      if (
        //ctx.state.status !== 'onCall' ||
        //ctx.state.screenDisableUserValidated === true
        ctx.state.displayScreenInfoStop === false
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
      const count = ctx.state.remoteListSrc.size;
      if (count === 0) {
        return <View style={styles.remoteContainer} />;
      }
      const streams = Array.from(ctx.state.remoteListSrc.values());
      // 1-2 streams : column, each tile flex:1
      // 3+ streams  : row wrap, each tile 50% width, scrollable
      if (count <= 2) {
        return (
          <View style={[styles.remoteContainer, {flexDirection: 'column'}]}>
            {streams.map((value, index) => (
              <TouchableOpacity
                key={index}
                style={styles.remoteViewHalf}
                onLongPress={evt => ctx.menuOptionRemote(index, value, evt)}>
                <RTCView
                  streamURL={value}
                  style={{width: '100%', height: '100%'}}
                  objectFit="cover"
                  zOrder={0}
                />
              </TouchableOpacity>
            ))}
          </View>
        );
      }
      return (
        <View style={styles.remoteContainer}>
          <ScrollView style={styles.scollView}>
            <View style={styles.remoteContainerFlex}>
              {streams.map((value, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.remoteViewGrid}
                  onLongPress={evt => ctx.menuOptionRemote(index, value, evt)}>
                  <RTCView
                    streamURL={value}
                    style={{width: '100%', height: '100%'}}
                    objectFit="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
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
          <View style={styles.ctrlGroup}>
            <TouchableOpacity
              style={[
                styles.renderButtonComponent,
                Platform.OS === 'android' && styles.ctrlGroupVideoBtn,
              ]}
              onPress={() => {
                ctx.muteVideo();
              }}>
              <View style={styles.svgButton}>{renderMuteVideoButton(ctx)}</View>
            </TouchableOpacity>
            {Platform.OS === 'android' && (
              <TouchableOpacity
                style={[
                  styles.chevronBtn,
                  ctx.state.videoEffectPanel && styles.chevronBtnOpen,
                ]}
                onPress={() => ctx.toggleVideoEffectPanel()}>
                <View style={styles.svgButton}>
                  <Chevron_up />
                </View>
              </TouchableOpacity>
            )}
          </View>
          {displayScreenShare(ctx)}
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

    function displayScreenShare(ctx) {
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

    function renderVideoEffectPanel(ctx) {
      if (Platform.OS !== 'android' || ctx.state.status !== 'onCall') {
        return null;
      }
      if (!ctx.state.videoEffectPanel) {
        return null;
      }
      return (
        <>
          <TouchableOpacity
            style={styles.panelOverlay}
            activeOpacity={1}
            onPress={() => ctx.setState({videoEffectPanel: false})}
          />
          <View style={styles.videoEffectPanel}>
            <Text style={styles.panelTitle}>Arrière-plan vidéo</Text>
            <View style={styles.bgOptionsGrid}>
              {BACKGROUNDS.map(bg => (
                <TouchableOpacity
                  key={bg.id}
                  style={[
                    styles.bgOption,
                    ctx.state.selectedBgEffect === bg.id &&
                      styles.bgOptionActive,
                  ]}
                  onPress={() => ctx.applyVideoEffect(bg)}
                  disabled={ctx.state.isApplyingBg}>
                  {bg.id === 'none' && (
                    <Text style={styles.bgOptionNoneText}>✕</Text>
                  )}
                  {bg.type === 'blur' && (
                    <View style={{width: 32, height: 32}}>
                      <Blur_on />
                    </View>
                  )}
                  {bg.thumbUri && (
                    <Image
                      source={{uri: bg.thumbUri}}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  )}
                  <Text
                    style={[
                      styles.bgOptionLabel,
                      bg.thumbUri ? styles.bgOptionLabelOverlay : null,
                    ]}>
                    {bg.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {ctx.state.isApplyingBg && (
              <Text style={styles.bgApplyingText}>Application…</Text>
            )}
          </View>
        </>
      );
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
        {renderWelcomeText(this)}
        {renderApiRTCCnx(this)}
        {renderPicker(this)}
        {renderFooter(this)}
        {renderRemoteViews(this)}
        {renderButtons(this)}
        {renderVideoEffectPanel(this)}
        {renderDialog(this)}
        {renderSelfView(this)}
        {renderScreenSelfView(this)}
        {chat(this)}
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
