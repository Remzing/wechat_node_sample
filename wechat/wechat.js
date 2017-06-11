'use strict'

var Promise = require('bluebird')
var _ = require('lodash')
var request = Promise.promisify(require("request")); //requset 改为Promise
var util = require('./util')
var api = require('../config/api')
var fs = require('fs')


/**
 * 获取和更新access_token，以保证access_token正常，使接口调用正常进行
 * params opts 与微信接口连通、调试的配置项
 */
function Wechat(opts) {
	var that = this;
	this.appID = opts.appID;
	this.appSecret = opts.appSecret;
	this.getAccessToken = opts.getAccessToken;
	this.saveAccessToken = opts.saveAccessToken;

	this.fetchAccessToken()
}

/**
 * 获取票据
 */
Wechat.prototype.fetchAccessToken = function() {
	var that = this;

	//判断access_token 是否已经存在、过期，
	if (this.access_token && this.expires_in) {
		if (this.isValidAccessToken) {
			return Promise.resolve(this)
		}

	}

	//带then函数之后，该对象变为promise对象
	return this
		.getAccessToken()
		.then(function(data) {
			try {
				data = JSON.parse(data);
			}
			catch(e) {
				//不合法或者失败，更新一下票据
				return that.updateAccessToken();	
			}
			// console.log('ryy-data1',data)
			//票据是否有效
			if (that.isValidAccessToken(data)) {
				//把data传下去
				return Promise.resolve(data);
				// return data;
			}
			else {
				return that.updateAccessToken();
			}
		})
		.then(function(data) {
			that.access_token = data.access_token;	//票据
			that.expires_in = data.expires_in;	//过期时间
			// console.log('ryy-data2',data)
			that.saveAccessToken(data);

			return Promise.resolve(data)
		})
}

/**
 * 判断票据是否过期
 */
Wechat.prototype.isValidAccessToken = function(data) {
	if (!data || !data.access_token || !data.expires_in) {
		return false;
	}
	// console.log('ryy-data3',data)
	var access_token = data.access_token;
	var expires_in = data.expires_in;
	var now = (new Date().getTime());
	// console.log('ryy-data4',data)
	if (now < expires_in) {
		return true;
	}
	else {
		return false;
	}
}

/**
 * 更新票据
 * @return 
 */
Wechat.prototype.updateAccessToken = function() {
	var appID = this.appID;
	var appSecret = this.appSecret;
	var url = api.accessToken + '&appid='+ appID +'&secret=' + appSecret ;

	return new Promise(function(resolve, reject){
		//向服务器发起请求，get,post方式自己定
		request({url: url, json: true}).then(function(response) {
			var data = response.body;

			var now = (new Date().getTime());
			
			// 提前20秒刷新,考虑网络延迟
			var expires_in = now + (data.expires_in - 20) * 1000;

			data.expires_in = expires_in;

			resolve(data)
		})
	})
}

/**
 * 上传素材
 * @params type 上传素材的类型
 * @params material 上传该素材的一些必要数据
 * @params permanent 通过这个参数有无，判断上传素材的类型是临时还是永久
 * @return 
 */
Wechat.prototype.uploadMaterial = function(type, material, permanent) {
	var that = this ;
	var form = {};
	var uploadUrl = api.temporary.upload;

	//是否是上传永久素材
	if (permanent) {
		uploadUrl = api.permanent.upload;

		//????
		_.extend(form, permanent)
	}

	if (type === 'pic') {
		uploadUrl = api.permanent.uploadNewsPic;

	}

	if (type === 'news') {
		uploadUrl = api.permanent.uploadNews;
		form = material
	}
	else {
		form.media = fs.createReadStream(material);
	}

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = uploadUrl + 'access_token=' + data.access_token;

				if (!permanent) {
					url += '&type=' + type;
				}
				else {
					form.access_token = data.access_token;
				}
				
				var options = {
					method: 'POST',
					url: url,
					json: true,
				}

				if (type ==='news') {
					options.body = form;
				}
				else {
					options.formData = form;
				}
				console.log('ryy-upload:'+JSON.stringify(options))
				//向服务器发起请求（把文件上传上去），之后返回回来的信息传给其他地方用作提取回复信息的必要条件，如：data.media_id
				request(options).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Upload material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 获取素材
 */
Wechat.prototype.fetchMaterial = function(mediaId, type, permanent) {
	var that = this ;
	var fetchUrl = api.temporary.fetch;
	
	//是否是获取永久素材
	if (permanent) {
		fetchUrl = api.permanent.fetch;
	}

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = fetchUrl + 'access_token=' + data.access_token 
				var options = {method:'POST', url: url, json: true}
				var form = {}

				if (permanent) {
					form.media_id = mediaId;
					form.access_token = data.access_token
					options.body = form
				}
				else {
					//临时视频素材 协议不是https，是临时视频素材需要换协议http
					if (trpe === 'video') {
						url = url.repalce('https://', 'http://')
					}

					url += '&media_id=' + mediaId
				}
				
				console.log('ryy-fetch-options0:' + JSON.stringify(options))
				console.log('ryy-fetch-mediaId:' + mediaId)
				//如果是图文或者视频就去请求对应的素材数据
				if (type === 'news' || type === 'video') {
					request(options).then(function(response) {
						var _data = response.body;
						console.log('ryy-29-1:' + JSON.stringify(_data))
						if (_data) {
							resolve(_data)
						}
						else {
							throw new Error('Fetch material fails')
						}
					})
					.catch(function(err) {
						reject(err)
					})
				}
				else {
					resolve(url)
				}
			})	
	})
}

/**
 * 删除素材
 */
Wechat.prototype.deleteMaterial = function(mediaId) {
	var that = this ;
	var form = {
		media_id: mediaId
	};

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.permanent.del + 'access_token=' + data.access_token + '&media_id=' + mediaId

				request({method:'POST',url: url, body: form, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Delete material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 各种素材数量（video,image,voice,news）
 */
Wechat.prototype.countMaterial = function() {
	var that = this ;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.permanent.count + 'access_token=' + data.access_token

				request({method:'GET',url: url, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('count material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 批量获取所有素材的详细数据
 */
Wechat.prototype.batchMaterial = function(options) {
	var that = this ;

	options.type = options.type || 'image';
	options.offset = options.offset || 0;
	options.count = options.count || 1;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.permanent.batch + 'access_token=' + data.access_token

				request({method:'POST',url: url, body: options, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Batch material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 更新素材
 */
Wechat.prototype.updateMaterial = function(mediaId, news) {
	var that = this ;
	var form = {
		media_id: mediaId
	};

	_.extend(form, news)

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.permanent.update + 'access_token=' + data.access_token + '&media_id=' + mediaId

				request({method:'POST',url: url, body: form, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Update material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 创建标签
 */
Wechat.prototype.createTag = function(name) {
	var that = this ;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.tags.create + 'access_token=' + data.access_token 

				var form = {
					tag: {
						name: name
					}
				}

				request({method:'POST',url: url, body: form, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Create tag  fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 获取标签
 */
Wechat.prototype.fetchTag = function() {
	var that = this ;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.tags.fetch + 'access_token=' + data.access_token 

				var form = {
					tag: {
						name: name
					}
				}

				request({url: url, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Create tag  fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 更新标签
 */
Wechat.prototype.updateTag = function(id, name) {
	var that = this ;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.tags.update + 'access_token=' + data.access_token 

				var form = {
					tag: {
						id: id,
						name: name
					}
				}

				request({method:'POST',url: url, body: form, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Create tag  fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 创建菜单
 */
Wechat.prototype.createMenu = function(menu) {
	var that = this ;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.menu.create + 'access_token=' + data.access_token 

				request({method:'POST',url: url, body: menu, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Create menu  fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 获取菜单
 */
Wechat.prototype.getMenu = function(menu) {
	var that = this ;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.menu.get + 'access_token=' + data.access_token 

				request({url: url, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Get menu  fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 删除菜单
 */
Wechat.prototype.deleteMenu = function() {
	var that = this ;
	console.log('ryy-test2')
	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				console.log('ryy-test3')
				var url = api.menu.del + 'access_token=' + data.access_token

				request({url: url, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Delete menu fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 获取自定义菜单
 */
Wechat.prototype.getCurrentMenu = function(menu) {
	var that = this ;

	return new Promise(function(resolve, reject){
		that
			.fetchAccessToken()
			.then(function(data) {
				var url = api.menu.current + 'access_token=' + data.access_token 

				request({url: url, json: true}).then(function(response) {
					var _data = response.body;

					if (_data) {
						resolve(_data)
					}
					else {
						throw new Error('Get current menu  fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

/**
 * 拼接返回xml，发送xml信息
 */
Wechat.prototype.reply = function() {
	var content = this.body;
	var message = this.weixin;

	var xml = util.tpl(content, message)

	console.log('ryy-reply:'+xml.toString())
	this.status = 200;
	this.type = 'application/xml';
	this.body = xml
}

module.exports = Wechat;