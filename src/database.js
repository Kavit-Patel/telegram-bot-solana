import { JSONFilePreset } from 'lowdb/node'

export const db = await JSONFilePreset('db.json', {
  users: {},
  transactions: {}
})

export const getUser = (userId) => db.data.users[userId] || null
export const updateUser = async (userId, data) => {
  await db.update(({ users }) => {
    users[userId] = { ...users[userId], ...data }
  })
}
export const deleteUser = async (userId) => {
  await db.update(({ users }) => {
    delete users[userId]
  })
}
export const trackTransaction = async (txSig) => {
  await db.update(({ transactions }) => {
    transactions[txSig] = true
  })
}

export const setUserState = async (userId, state) => {
    await db.update(({ users }) => {
      users[userId] = users[userId] || {};
      users[userId].state = state;
      users[userId].stateTimestamp = new Date().toISOString();
    });
  }
  
  export const clearUserState = async (userId) => {
    await db.update(({ users }) => {
      if(users[userId]) {
        delete users[userId].state;
      }
    });
  }

  export const removeSubscription = async (userId) => {
    await db.update(({ users }) => {
      if(users[userId]?.subscriptionId) {
        connection.removeOnLogsListener(users[userId].subscriptionId);
        delete users[userId].subscriptionId;
      }
    });
  };
  