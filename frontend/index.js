/**
 * @format
 */

import { AppRegistry } from 'react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { name as appName } from './app.json';
import { registerBackgroundEvent } from './src/services/notifications/backgroundEvent';

// Register the notifee background event handler FIRST, before registerComponent and
// outside the try/catch below. A JS bundle-load failure must not orphan a ringing,
// looping call notification — the handler must always be installed.
registerBackgroundEvent();

let RootComponent;

try {
	// Keep bootstrap imports inside try so registerComponent still runs if one fails.
	require('./src/utils/localStoragePolyfill');
	require('react-native-gesture-handler');
	require('./global.css');
	RootComponent = require('./src/App').default;
} catch (error) {
	console.error('[bootstrap] Failed to load app entry', error);
	RootComponent = () =>
		React.createElement(
			View,
			{
				style: {
					alignItems: 'center',
					flex: 1,
					justifyContent: 'center',
					padding: 24,
				},
			},
			React.createElement(
				Text,
				{ style: { color: '#111827', fontSize: 16, textAlign: 'center' } },
				'App bootstrap failed. Check Metro logs for the error: ' + String(error.message),
			),
		);
}

AppRegistry.registerComponent(appName, () => RootComponent);
