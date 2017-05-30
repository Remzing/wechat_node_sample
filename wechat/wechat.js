'use strict'

var Promise = require('bluebird')
var _ = require('lodash')
var request = Promise.promisify(require("request")); //requset 改为Promise
var util = require('./util')
var fs = require('fs')

var prefix = 'https://api.weixin.qq.com/cgi-bin/'
var api = {
	accessToken: prefix + 'token?grant_type=client_credential',
	//上传格式。参见微信开发者文档
	temporary: {//临时
		upload: prefix + 'media/upload?',
		fetch: prefix + 'media/get?'
	},
	permanent: {//永久
		upload: prefix + 'material/add_material?',
		fetch: prefix + 'material/get_material?',
		uploadNews: prefix + 'material/add_news?',
		uploadNewsPic: prefix + 'media/uploadimg?',
		del: prefix + 'material/del_material?',
		update: prefix + 'material/update_news?',
		count: prefix + 'material/get_materialcount?',
		batch: prefix + 'material/batchget_material?',
		
	}
}
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

Wechat.prototype.fetchAccessToken = function() {
	var that = this;

	//判断access_token 是否已经存在、过期，
	if (this.access_token && this.expires_in) {
		if (this.isValidAccessToken) {
			return Promise.resolve(this)
		}

	}

	//带then函数之后，该对象变为promise对象
	this
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
				
				console.log('ryy-29-0:' + JSON.stringify(options))
				console.log('ryy1111111111:' + mediaId)
				//如果是图文或者视频就去请求对应的素材数据
				if (type === 'news' || type === 'video') {
					request(options).then(function(response) {
						var _data = response.body;
						console.log('ryy-29-1:' + JSON.stringify(_data))
						if (_data) {
							resolve(_data)
						}
						else {
							throw new Error('fetch material fails')
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
						throw new Error('Delete material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

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
						throw new Error('Delete material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}


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
						throw new Error('Delete material fails')
					}
				})
				.catch(function(err) {
					reject(err)
				})
			})
	})
}

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