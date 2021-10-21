import {
	IExecuteFunctions,
} from 'n8n-core';

import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import {
	ICard,
	IMessage,
	IMessageUi,
} from './MessageInterface';

import {
	attachmentFields,
	attachmentOperations,
	mediaFields,
	mediaOperations,
	memberFields,
	memberOperations,
	messageFields,
	messageOperations,
	spaceFields,
	spaceOperations
} from './descriptions';

import {
	googleApiRequest, googleApiRequestAllItems,
	validateJSON,
} from './GenericFunctions';

export class GoogleChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Chat',
		name: 'googleChat',
		icon: 'file:googleChat.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Google Chat API',
		defaults: {
			name: 'Google Chat',
			color: '#3E87E4',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'googleApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Media',
						value: 'media',
					},
					{
						name: 'Space',
						value: 'space',
					},
					{
						name: 'Member',
						value: 'member',
					},
					{
						name: 'Message',
						value: 'message',
					},
					{
						name: 'Attachment',
						value: 'attachment',
					},
				],
				default: 'message',
				description: 'The resource to operate on.',
			},
			...mediaOperations,
			...mediaFields,
			...spaceOperations,
			...spaceFields,
			...memberOperations,
			...memberFields,
			...messageOperations,
			...messageFields,
			...attachmentOperations,
			...attachmentFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = (items.length as unknown) as number;
		const qs: IDataObject = {};
		let responseData;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		for (let i = 0; i < length; i++) {
			try {
				if (resource === 'media') {
					if (operation === 'download') {
						// ----------------------------------------
						//             media: download
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/media/download

						const resourceName = this.getNodeParameter('resourceName', i) as string;

						responseData = await googleApiRequest.call(
							this,
							'GET',
							`/v1/media/${resourceName}?alt=media`,
						);
					}

				} else if (resource === 'space') {
					if (operation === 'get') {

						// ----------------------------------------
						//             space: get
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces/get

						const spaceName = this.getNodeParameter('spaceName', i) as string;

						responseData = await googleApiRequest.call(
							this,
							'GET',
							`/v1/${spaceName}`,
						);

					} else if (operation === 'getAll') {

						// ----------------------------------------
						//             space: getAll
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces/list

						const returnAll = this.getNodeParameter('returnAll', 0) as IDataObject;
						if (returnAll) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'spaces',
								'GET',
								`/v1/spaces`,
								undefined,
								qs,
							);
						}
						else {
							const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
							qs.pageSize = additionalFields.pageSize as number >>> 0; // convert to an unsigned 32-bit integer
							qs.pageToken = additionalFields.pageToken;

							responseData = await googleApiRequest.call(
								this,
								'GET',
								`/v1/spaces`,
								undefined,
								qs,
							);
						}

					}

				} else if (resource === 'member') {
					if (operation === 'get') {

						// ----------------------------------------
						//             member: get
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces.members/get

						const spaceName = this.getNodeParameter('spaceName', i) as string;
						const memberName = this.getNodeParameter('memberName', i) as string;

						responseData = await googleApiRequest.call(
							this,
							'GET',
							`/v1/spaces/${spaceName}/members/${memberName}`,
						);

					} else if (operation === 'getAll') {

						// ----------------------------------------
						//             member: getAll
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces.members/list

						const spaceName = this.getNodeParameter('spaceName', i) as string;

						const returnAll = this.getNodeParameter('returnAll', 0) as IDataObject;
						if (returnAll) {
							responseData = await googleApiRequestAllItems.call(
								this,
								'memberships',
								'GET',
								`/v1/spaces/${spaceName}/members`,
								undefined,
								qs,
							);

						} else {
							// get additional fields input for pageSize and pageToken
							const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
							qs.pageSize = additionalFields.pageSize as number >>> 0; // convert to an unsigned 32-bit integer
							qs.pageToken = additionalFields.pageToken;

							responseData = await googleApiRequest.call(
								this,
								'GET',
								`/v1/spaces/${spaceName}/members`,
								undefined,
								qs,
							);
						}

					}
				} else if (resource === 'message') {
					if (operation === 'create'){

						// ----------------------------------------
						//             message: create
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces.messages/create

						const spaceName = this.getNodeParameter('spaceName', i) as string;

						qs.threadKey = this.getNodeParameter('threadKey', i) as string;

						let message: IMessage = {};
						const jsonParameterMessage = this.getNodeParameter('jsonParameterMessage', i) as string;
						if (jsonParameterMessage) {
							const jsonStr = this.getNodeParameter('messageJson', i) as string;

							if (validateJSON(jsonStr) !== undefined) {
								message = JSON.parse(jsonStr) as IMessage;
							} else {
								throw new NodeOperationError(this.getNode(), 'Message (JSON) must be a valid json');
							}

						} else {
							const messageUi = this.getNodeParameter('messageUi', i) as IMessageUi;
							if (messageUi.text && messageUi.text !== '') {
								message.text = messageUi.text;
							} else {
								throw new NodeOperationError(this.getNode(), 'Message Text must be provided.');
							}
							// 	// todo: get cards from the ui
							// if (messageUi?.cards?.metadataValues && messageUi?.cards?.metadataValues.length !== 0) {
							// 	const cards = messageUi.cards.metadataValues as IDataObject[]; // todo: map cards to messageUi.cards.metadataValues
							// 	message.cards = cards;
							// }
						}

						const body: IDataObject = {};
						Object.assign(body, message);

						responseData = await googleApiRequest.call(
							this,
							'POST',
							`/v1/spaces/${spaceName}`,
							body,
							qs,
						);

					} else if (operation === 'delete') {

						// ----------------------------------------
						//             message: delete
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces.messages/delete

						const spaceName = this.getNodeParameter('spaceName', i) as string;
						const messageName = this.getNodeParameter('messageName', i) as string;

						responseData = await googleApiRequest.call(
							this,
							'DELETE',
							`/v1/spaces/${spaceName}/messages/${messageName}`,
						);

					} else if (operation === 'get') {

						// ----------------------------------------
						//             message: get
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces.messages/get

						const spaceName = this.getNodeParameter('spaceName', i) as string;
						const messageName = this.getNodeParameter('messageName', i) as string;

						responseData = await googleApiRequest.call(
							this,
							'GET',
							`/v1/spaces/${spaceName}/messages/${messageName}`,
						);

					} else if (operation === 'update') {

						// ----------------------------------------
						//             message: update
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces.messages/update

						const spaceName = this.getNodeParameter('spaceName', i) as string;
						const messageName = this.getNodeParameter('messageName', i) as string;

						const updateMaskOptions = this.getNodeParameter('updateMask', i) as string[];
						if (updateMaskOptions.length !== 0) {
							let updateMask = '';
							for (const option of updateMaskOptions) {
								updateMask += option + ',';
							}
							updateMask = updateMask.slice(0, -1); // remove trailing comma
							qs.updateMask = updateMask;
						} else {
							throw new NodeOperationError(this.getNode(), 'Update Mask must not be empty.');
						}

						let updateOptions: IMessage = {};
						const jsonParameterUpdateOptions = this.getNodeParameter('jsonParameterUpdateOptions', i) as boolean;
						if (jsonParameterUpdateOptions) {
							const jsonStr = this.getNodeParameter('updateOptionsJson', i) as string;
							if (validateJSON(jsonStr) !== undefined) {
								updateOptions = JSON.parse(jsonStr) as IDataObject;
							} else {
								throw new NodeOperationError(this.getNode(), 'Update Options (JSON) must be a valid json');
							}
						} else {
							if (updateMaskOptions.includes('text')) {
								const text = this.getNodeParameter('textUi', i) as string;
								if (text !== '') {
									updateOptions.text = text;
								} else {
									throw new NodeOperationError(this.getNode(), 'Text input must be provided.');
								}
							}
							// if (updateMaskOptions.includes('cards')) {
							// 	// todo: get cards from the ui
							// 	const cardsUi = this.getNodeParameter('cardsUi.metadataValues', i) as IDataObject[];
							// 	if (cardsUi.length !== 0) {
							// 		updateOptions.cards = cardsUi as IDataObject[]; // todo: map cardsUi to cards[]
							// 	}
							// }
						}

						const body: IDataObject = {};
						Object.assign(body, updateOptions);

						responseData = await googleApiRequest.call(
							this,
							'POST',
							`/v1/spaces/${spaceName}/messages/${messageName}`,
							body,
							qs,
						);
					}

				} else if (resource === 'attachment') {

					if (operation === 'get') {
						// ----------------------------------------
						//             attachment: get
						// ----------------------------------------

						// https://developers.google.com/chat/reference/rest/v1/spaces.messages.attachments/get

						const spaceName = this.getNodeParameter('spaceName', i) as string;
						const messageName = this.getNodeParameter('messageName', i) as string;
						const attachmentName = this.getNodeParameter('attachmentName', i) as string;

						responseData = await googleApiRequest.call(
							this,
							'POST',
							`/v1/spaces/${spaceName}/messages/${messageName}/attachments/${attachmentName}`,
						);
					}
				}
				if (Array.isArray(responseData)) {
					returnData.push.apply(returnData, responseData as IDataObject[]);
				} else if (responseData !== undefined) {
					returnData.push(responseData as IDataObject);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					// Return the actual reason as error
					returnData.push({ error: error.message });
					continue;
				}
				throw error;
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}