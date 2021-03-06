const DBConnectionPool          = require("./connection");

module.exports = class Repository {

    constructor() {
        this.db = new DBConnectionPool();
    }

    find (criteria, offset, limit, order, totalCountOnly = false) {
        let fields = Object.keys(criteria);
        let condition = 'WHERE `' + fields.join('` = ? AND `') + '` = ?';
        let parameters = fields.map(field => typeof criteria[field] == 'object' ? JSON.stringify(criteria[field]) : criteria[field]);
        let limitQuery, orderQuery;

        if(order === undefined) {
            orderQuery = '';
        } else {
            orderQuery = order.replace(/^(?:([+\-])([\w_]+)|(.*))$/, (k, direction, field, notMatched) => notMatched? '' : ('ORDER BY ' + field + (direction === "+"? ' ASC' : ' DESC')));
        }

        if (totalCountOnly || (limit === undefined && offset === undefined)) {
            limitQuery = '';
        } else if (!isNaN(limit) && !isNaN(offset)) {
            limitQuery = `LIMIT ${offset}, ${limit}`;
        } else {
            throw new Error(`Both parameters the limit and offset are expected, or none. Given only ${isNaN(limit) ? 'offset' : 'limit'}`);
        }

        let query = `SELECT ${totalCountOnly? 'count(*) as total' : '*'} FROM ${this.__table__} ${fields.length ? condition : ''} ${orderQuery} ${limitQuery}`;

        return this.db.execute(query, parameters)
            .then(([rows]) => rows);
    }

    save (model) {
        let query;
        let fields = Object.keys(model.__properties__);
        let parameters = fields.reduce((params, field) => {
            let [key, value] = _parametersFormat(model.__properties__[field]);
            params.placeholders.push(`\`${field}\` = ${key}`);
            params.values.push(value);
            return params;
        }, {placeholders: [], values: []});


        if (model.__unsaved__) {
            query = `INSERT ${this.__table__} SET ${parameters.placeholders.join(',')}`;
        } else {
            query = `UPDATE ${this.__table__} SET ${parameters.placeholders.join(',')} WHERE ${this.__table__}.id = ?`;
            parameters.values.push(model.id);
        }

        return this.db.execute(query, parameters.values)
            .then(([result]) => {
                if (result.insertId) {
                    Object.entries(model.scheme).some(([keyName, property]) => {
                        if(property.isPrimaryKey) {
                            model[keyName] = result.insertId;
                            return true;
                        }
                    });
                }
                model.__unsaved__ = false;
                return model;
            });
    }

    remove (model) {
        let condition = 'WHERE ';
        let parameters;
        let fields;

        if (model.__properties__.hasOwnProperty('id')) {
            condition += ' `id` = ?';
            parameters = [model.id];
        } else {
            fields = Object.keys(model.__properties__);
            condition += fields.join(' = ? AND ') + ' = ?';
            parameters = fields.map(field => model.__properties__[field]);
        }
        let query = `DELETE FROM ${this.__table__} ${condition}`;

        return this.db.execute(query, parameters)
            .then(([result]) => result);
    }
};

function _parametersFormat (propertyValue) {
    let result = ['?', propertyValue];

    switch (typeof propertyValue) {
        case "object":
            if (propertyValue instanceof Date) {
                result = ["FROM_UNIXTIME(?)", Math.round(propertyValue.getTime() / 1000)];
            } else if (propertyValue) {
                result[1] = JSON.stringify(propertyValue);
            } else {
                result[1] = null;
            }
            break;
        case "undefined":
            result[1] = null;
            break;
    }
    return result;
}
