//
//  ReactNativeApiRTC_RPK.swift
//  reactNativeApiRTC
//
//  Created by Fred on 22/04/2024.
//

import Foundation
import ReplayKit
import Photos
import UIKit

@objc(ReactNativeApiRTC_RPK)
class ReactNativeApiRTC_RPK: RCTEventEmitter {
  
  private var status = "Empty"
  
  var start_notification_callback: CFNotificationCallback = { center, observer, name, object, info in
    NotificationCenter.default.post(name: Notification.Name("START_BROADCAST"), object: nil)
  }
  
  var stop_notification_callback: CFNotificationCallback = { center, observer, name, object, info in
    NotificationCenter.default.post(name: Notification.Name("STOP_BROADCAST"), object: nil)
  }
  
  override init() {
    super.init()
    NotificationCenter.default.addObserver(self, selector: #selector(self.startBroadcastCallback(notification:)), name: Notification.Name("START_BROADCAST"), object: nil)
    
    NotificationCenter.default.addObserver(self, selector: #selector(self.stopBroadcastCallback(notification:)), name: Notification.Name("STOP_BROADCAST"), object: nil)
    
    let notificationStartIdentifier = "com.reactnativeapirtc.notification.broadcaststart" as CFString
    let notificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
    
    CFNotificationCenterAddObserver(notificationCenter,
                                    nil,
                                    start_notification_callback,
                                    notificationStartIdentifier,
                                    nil,
                                    CFNotificationSuspensionBehavior.deliverImmediately)
    
    
    let notificationStopIdentifier = "com.reactnativeapirtc.notification.broadcaststop" as CFString
    
    CFNotificationCenterAddObserver(notificationCenter,
                                    nil,
                                    stop_notification_callback,
                                    notificationStopIdentifier,
                                    nil,
                                    CFNotificationSuspensionBehavior.deliverImmediately)
  }
  
  @objc func startBroadcastCallback(notification: NSNotification){
    status = "START_BROADCAST"
    sendEvent(withName: "onScreenShare", body: status)
    status="STARTED_BROADCASTING"
  }
  
  @objc func stopBroadcastCallback(notification: NSNotification){
    status = "STOP_BROADCAST"
    sendEvent(withName: "onScreenShare", body: status)
    status = "Empty"
  }

  //This function is used to send a notification to the extension to stop the broadcast
  @objc
  func sendBroadcastNeedToBeStopped() {
    //Sending event to screen sharing extension
    let notificationName = CFNotificationName("com.reactnativeapirtc.notification.broadcastneedtobestopped" as CFString)
    let notificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
    CFNotificationCenterPostNotification(notificationCenter, notificationName, nil, nil, true)
  }
  
  override func supportedEvents() -> [String]! {
    return ["onScreenShare"]
  }
  override func constantsToExport() -> [AnyHashable : Any]! {
    return ["initialCount": status]
  }
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
