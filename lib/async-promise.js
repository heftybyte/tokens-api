export const all = (obj) => {
	return new Promise(async (resolve, reject)=>{
		if (Array.isArray(obj)) {
			return Promise.all(obj)
		}
		if (typeof obj !== 'object') {
			return reject()
		}
		const keys = Object.keys(obj)
		const values = await Promise.all(keys.map((key)=>{
			return obj[key]
		})).catch(reject)
		const map = {}
		keys.forEach((key, i)=>{
			map[key] = values[i]
		})
		resolve(map)
	})
}