import { Kafka } from "kafkajs";
import { submitProblemFromKafka } from "../controllers/submission.controller.js";
import {config} from "../../config/env.js";

const KafkaProducerSingleton = (function () {
    let instance;

    function init() {
        const client = new Kafka({
            clientId: 'bnoj-app',
            brokers: [config.kafka_broker||'kafka:9092'],
            connectionTimeout: 30000,
            requestTimeout: 45000,
        });

        const producer = client.producer();
        const consumer = client.consumer({
            groupId: 'bnoj-group-1'
        });

        const admin = client.admin(); // ✅ Thêm admin client

        let isProducerConnected = false;
        let isConsumerConnected = false;
        let isAdminConnected = false;

        return {
            // 🔴 FIX 1: Tách riêng connect cho producer
            async connectProducer() {
                if (!isProducerConnected) {
                    try {
                        await producer.connect();
                        isProducerConnected = true;
                        console.log('✅ Kafka Producer connected');
                    } catch (error) {
                        console.error('❌ Producer connection failed:', error);
                        throw error;
                    }
                }
            },

            // 🔴 FIX 2: Tách riêng connect cho consumer
            async connectConsumer() {
                if (!isConsumerConnected) {
                    try {
                        await consumer.connect();
                        isConsumerConnected = true;
                        console.log('✅ Kafka Consumer connected');
                    } catch (error) {
                        console.error('❌ Consumer connection failed:', error);
                        throw error;
                    }
                }
            },

            async createTopicIfNotExists(topic, numPartitions = 1, replicationFactor = 1) {
                try {
                    if (!isAdminConnected) {
                        console.log('🔄 Connecting Kafka Admin...');
                        await admin.connect();
                        isAdminConnected = true;
                        console.log('✅ Kafka Admin connected');
                    }

                    // Kiểm tra topic đã tồn tại chưa
                    const existingTopics = await admin.listTopics();

                    if (existingTopics.includes(topic)) {
                        console.log(`ℹ️ Topic "${topic}" already exists`);
                        return;
                    }

                    // Tạo topic mới
                    await admin.createTopics({
                        topics: [{
                            topic: topic,
                            numPartitions: numPartitions,
                            replicationFactor: replicationFactor,
                        }],
                        waitForLeaders: true,
                        timeout: 30000,
                    });

                    console.log(`✅ Topic "${topic}" created successfully`);

                    // Đợi một chút để topic được khởi tạo hoàn toàn
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (error) {
                    if (error.type === 'TOPIC_ALREADY_EXISTS') {
                        console.log(`ℹ️ Topic "${topic}" already exists`);
                    } else {
                        console.error(`❌ Failed to create topic "${topic}":`, error.message);
                        throw error;
                    }
                }
            },

            async sendMessage(topic, message) {
                // 🔴 FIX 3: Đảm bảo producer connect trước
                await this.connectProducer();

                try {
                    const result = await producer.send({
                        topic: topic,
                        messages: [{ value: JSON.stringify(message) }],
                        timeout: 30000,
                    });
                    console.log(`✅ Message sent to topic "${topic}":`, message);
                    return result;
                } catch (error) {
                    console.error(`❌ Failed to send message to "${topic}":`, error);
                    throw error;
                }
            },

            async subscribeForCompiler(topic) {
                // 🔴 FIX 4: Đảm bảo consumer connect trước
                await this.connectConsumer();

                try {
                    console.log(`📡 Subscribing to topic: ${topic}`);
                    await consumer.subscribe({ topic: topic });

                    // 🔴 FIX 5: Sử dụng arrow function để giữ 'this' context
                    await consumer.run({
                        eachMessage: async ({ topic, partition, message }) => {
                            try {
                                const data = JSON.parse(message.value.toString());
                                const time = new Date().toISOString();

                                console.log(`[${time}] 📥 Received message from "${topic}":`, data["_id"]);

                                // Process the message
                                const response = await submitProblemFromKafka(data);
                                console.log(`[${time}] ✅ Finished processing:`, response);

                                // Send result back - MUST use await this.sendMessage
                                await this.sendMessage('result-topic', response);

                            } catch (error) {
                                console.error(`❌ Error processing message from "${topic}":`, error);
                            }
                        },
                        eachBatchAutoResolve: true,
                    });
                } catch (error) {
                    console.error('❌ Subscribe failed:', error);
                    throw error;
                }
            },

            async disconnect() {
                try {
                    if (isProducerConnected) {
                        await producer.disconnect();
                        isProducerConnected = false;
                        console.log('✅ Producer disconnected');
                    }
                    if (isConsumerConnected) {
                        await consumer.disconnect();
                        isConsumerConnected = false;
                        console.log('✅ Consumer disconnected');
                    }
                } catch (error) {
                    console.error('❌ Disconnect error:', error);
                }
            }
        };
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = init();
            }
            return instance;
        }
    };
})();

// Export functions
export const subscribeForCompiler = async (topic) => {
    const kafka = KafkaProducerSingleton.getInstance();
    await kafka.subscribeForCompiler(topic);
};

export const sendMessage = async (topic, message) => {
    const kafka = KafkaProducerSingleton.getInstance();
    const time = new Date().toISOString();
    console.log(`[${time}] 📤 Sending message to topic "${topic}"`);
    return await kafka.sendMessage(topic, message);
};

export const createTopic = async (topic, numPartitions = 1, replicationFactor = 1) => {
    const kafka = KafkaProducerSingleton.getInstance();
    await kafka.createTopicIfNotExists(topic, numPartitions, replicationFactor);
};


export default KafkaProducerSingleton;