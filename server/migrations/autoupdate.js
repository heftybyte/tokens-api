import server from '../server'

const ds = server.dataSources.arangodbDs

const model = process.argv[2];

const collections = model ?
	[model] :
	server.models().map((model)=>model.modelName)

collections.forEach((modelName)=>{

	ds.isActual(modelName, (err, isActual)=>{

		if (isActual) {
			return
		}

		ds.autoupdate(modelName, (err)=> {
		  if (err) {
		  	console.error(err)
		  	return
		  }
		  console.log(`upated ${modelName}`)
		})

	})

})