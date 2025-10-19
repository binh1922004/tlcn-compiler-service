import { Kafka } from "kafkajs";
import { submitProblemFromKafka } from "../controllers/submission.controller.js";

const KafkaProducerSingleton = (function () {
    let instance;

    function init() {
        const client = new Kafka({
            clientId: 'bnoj-app',
            brokers: ['localhost:9092'],
            connectionTimeout: 30000,
            requestTimeout: 45000,
        });

        const producer = client.producer();
        const consumer = client.consumer({
            groupId: 'bnoj-group-1'
        });

        let isProducerConnected = false;
        let isConsumerConnected = false;

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

export default KafkaProducerSingleton;