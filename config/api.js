'use strict'

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
		
	},
	tags: {
		create: prefix + 'tags/create?',
		fetch: prefix + 'tags/get?',
		update: prefix + 'tags/update?',
		delete: prefix + 'tags/delete?',
		//获取标签下粉丝列表
		userOnTag: prefix + 'user/tag/get?',
		//批量为用户打标签
		addUserTag: prefix + 'tags/members/batchtagging?',
		//批量为用户取消标签
		delUserTag: prefix + 'tags/members/batchuntagging?',
		//获取用户身上的标签列表
		getUserTag: prefix + 'tags/getidlist?'
	},
	mass: {

	},
	menu: {
		create: prefix + 'menu/create?',
		get: prefix + 'menu/get?',
		del: prefix + 'menu/delete?',
		current: prefix + 'get_current_selfmenu_info?',
	}
}

module.exports = api