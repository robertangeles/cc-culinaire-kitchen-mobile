package com.anonymous.ccculinairekitchenmob.download

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native package registration for the background download module.
 *
 * Registered in MainApplication.kt's `getPackages()` list — the config
 * plugin injects the `add(BackgroundDownloadPackage())` line during
 * prebuild.
 */
class BackgroundDownloadPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): List<NativeModule> = listOf(BackgroundDownloadModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> = emptyList()
}
