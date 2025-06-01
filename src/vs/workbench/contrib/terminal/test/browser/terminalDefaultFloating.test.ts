/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ITerminalInstance, ITerminalService } from '../../browser/terminal.js';
import { TerminalLocation } from '../../../../../platform/terminal/common/terminal.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { workbenchInstantiationService } from '../../../../../workbench/test/browser/workbenchTestServices.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';

suite('Terminal Default Floating Setting', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let configurationService: TestConfigurationService;
	let terminalService: TestTerminalService;
	let moveIntoNewEditorCalled = false;

	class TestTerminalInstance extends Disposable implements Partial<ITerminalInstance> {
		readonly instanceId: number;
		readonly resource: URI;
		target = TerminalLocation.Panel;

		shellLaunchConfig = {
			hideFromUser: false
		};

		constructor(public readonly title: string, id: number) {
			super();
			this.instanceId = id;
			this.resource = URI.from({ scheme: 'terminal', path: id.toString() });
		}

		focusWhenReady(): Promise<void> {
			return Promise.resolve();
		}
	}

	class TestTerminalService extends Disposable implements Partial<ITerminalService> {
		declare readonly _serviceBrand: undefined;

		private _instances: TestTerminalInstance[] = [];
		private _nextInstanceId = 1;

		readonly onDidCreateInstance = Event.None;
		readonly onDidDisposeInstance = Event.None;
		readonly onDidFocusInstance = Event.None;
		readonly onDidChangeInstanceDimensions = Event.None;
		readonly onDidChangeInstanceMaximized = Event.None;
		readonly onDidChangeActiveInstance = Event.None;
		readonly onDidChangeInstances = Event.None;
		readonly onDidChangeInstanceTitle = Event.None;
		readonly onDidChangeInstanceIcon = Event.None;
		readonly onDidChangeInstanceColor = Event.None;
		readonly onDidChangeInstancePrimaryStatus = Event.None;
		readonly onDidRegisterProcessSupport = Event.None;

		constructor() {
			super();
			this._register(toDisposable(() => {
				for (const instance of this._instances) {
					instance.dispose();
				}
				this._instances = [];
			}));
		}

		get instances(): readonly ITerminalInstance[] {
			return this._instances as unknown as ITerminalInstance[];
		}

		async createTerminal(options?: any): Promise<ITerminalInstance> {
			const name = options?.config && typeof options.config === 'object' && 'profileName' in options.config ?
				options.config.profileName :
				`Terminal ${this._nextInstanceId}`;

			const instance = new TestTerminalInstance(name, this._nextInstanceId++);

			if (options?.config?.hideFromUser) {
				instance.shellLaunchConfig.hideFromUser = true;
			}

			this._register(instance);
			this._instances.push(instance);

			const configValue = await configurationService.getValue('terminal.integrated.defaultFloating');
			if (configValue === true && !instance.shellLaunchConfig.hideFromUser) {
				this.moveIntoNewEditor(instance as unknown as ITerminalInstance);
			}

			return instance as unknown as ITerminalInstance;
		}

		moveIntoNewEditor(_instance: ITerminalInstance): void {
			moveIntoNewEditorCalled = true;
		}
	}

	setup(() => {
		moveIntoNewEditorCalled = false;

		instantiationService = workbenchInstantiationService(undefined, store);

		configurationService = instantiationService.get(IConfigurationService) as TestConfigurationService;

		terminalService = store.add(new TestTerminalService());
	});

	test('should not create floating terminal when defaultFloating is false', async () => {
		await configurationService.setUserConfiguration('terminal', {
			integrated: {
				defaultFloating: false
			}
		});

		await terminalService.createTerminal({});

		assert.strictEqual(moveIntoNewEditorCalled, false, 'Terminal should not float when defaultFloating is disabled');
	});

	test('should create floating terminal when defaultFloating is true', async () => {
		await configurationService.setUserConfiguration('terminal', {
			integrated: {
				defaultFloating: true
			}
		});

		await terminalService.createTerminal({});

		assert.strictEqual(moveIntoNewEditorCalled, true, 'Terminal should float when defaultFloating is enabled');
	});

	test('should not create floating terminal when hideFromUser is true, even if defaultFloating is true', async () => {
		await configurationService.setUserConfiguration('terminal', {
			integrated: {
				defaultFloating: true
			}
		});

		await terminalService.createTerminal({
			config: {
				hideFromUser: true
			}
		});

		assert.strictEqual(moveIntoNewEditorCalled, false, 'Terminal should not float when hideFromUser is true');
	});
});
