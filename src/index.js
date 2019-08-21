const Errors                    = require("@dominion-framework/dominion/core/errors");
const RepositoryPrototype       = require("./repositoryPrototype");


class Repositories {
    static create(tableName, repositoryDefinition) {
        if (!tableName) {
            throw new Errors.Fatal(`Table name can not be empty.`);
        }

        const className = "Repository" + tableName[0].toUpperCase() + tableName.slice(1);
        const Repository = {[className] : class extends RepositoryPrototype {
              constructor() {
                  super();
                  this.__table__ = tableName;
              }
        }}[className];

        Object.assign(Repository.prototype, repositoryDefinition || {});

        return new Repository();
    }
}


module.exports = Repositories;
