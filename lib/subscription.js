Subscription = function(meteorSub) {
    var self = this;
    this.meteorSub = meteorSub;
    this.docHash = {};
    this.parentIds = {};
    this.refCounter = new DocumentRefCounter({
        onChange: function(collectionName, docId, refCount) {
            debugLog("Subscription.refCounter.onChange", collectionName + ":" + docId.valueOf() + " " + refCount);
            if (refCount <= 0) {
                meteorSub.removed(collectionName, docId);
                self._removeDocHash(collectionName, docId);
            }
        }
    });
};

Subscription.prototype.added = function(collectionName, doc, parentId) {
    var docId = doc._id;
    this.refCounter.increment(collectionName, docId);
    if (parentId) {
      if (!this.parentIds[docId]) {
        this.parentIds[docId] = [];
      }
      this.parentIds[docId] = _.union(this.parentIds[docId], [parentId]);
      doc.parentsIds = this.parentIds[docId];
    }
    if (this._hasDocChanged(collectionName, docId, doc)) {
        debugLog("Subscription.added", collectionName + ":" + docId);
        this.meteorSub.added(collectionName, docId, doc);
        this._addDocHash(collectionName, doc);
    }
};

Subscription.prototype.changed = function(collectionName, id, changes) {
    if (this._shouldSendChanges(collectionName, id, changes)) {
        debugLog("Subscription.changed", collectionName + ":" + id);
	if (this.parentIds[id] && this.parentIds[id].length) {
		// Send parentIds on each change
		changes.parentsIds = this.parentIds[id];
	}
        this.meteorSub.changed(collectionName, id, changes);
        this._updateDocHash(collectionName, id, changes);
    }
};

Subscription.prototype.removed = function(collectionName, id, parentId) {
    debugLog("Subscription.removed", collectionName + ":" + id.valueOf());
    if (parentId) {
      this.parentIds[id] = _.without(this.parentIds[id], [parentId]);
      var changes = {parentsIds: this.parentIds[id]};
      this.meteorSub.changed(collectionName, id, changes);
      this._updateDocHash(collectionName, id, changes);
    }
    this.refCounter.decrement(collectionName, id);
};

Subscription.prototype._addDocHash = function(collectionName, doc) {
    this.docHash[this._buildHashKey(collectionName, doc._id)] = doc;
};

Subscription.prototype._updateDocHash = function(collectionName, id, changes) {
    var key = this._buildHashKey(collectionName, id);
    var existingDoc = this.docHash[key] || {};
    this.docHash[key] = _.extend(existingDoc, changes);
};

Subscription.prototype._shouldSendChanges = function(collectionName, id, changes) {
    return this._isDocPublished(collectionName, id) &&
        this._hasDocChanged(collectionName, id, changes);
};

Subscription.prototype._isDocPublished = function(collectionName, id) {
    var key = this._buildHashKey(collectionName, id);
    return !!this.docHash[key];
};

Subscription.prototype._hasDocChanged = function(collectionName, id, doc) {
    var existingDoc = this.docHash[this._buildHashKey(collectionName, id)];

    if (!existingDoc) { return true; }

    for (var i in doc) {
        if (doc.hasOwnProperty(i) && !_.isEqual(doc[i], existingDoc[i])) {
            return true;
        }
    }

    return false;
};

Subscription.prototype._removeDocHash = function(collectionName, id) {
    var key = this._buildHashKey(collectionName, id);
    delete this.docHash[key];
};

Subscription.prototype._buildHashKey = function(collectionName, id) {
    return collectionName + "::" + id.valueOf();
};
