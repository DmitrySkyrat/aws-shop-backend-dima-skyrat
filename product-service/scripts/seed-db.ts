import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: 'us-east-1' }); // 👈 ЗАМЕНИ НА СВОЙ РЕГИОН
const dynamoDB = DynamoDBDocumentClient.from(client);

const products = [
  {
    id: uuidv4(),
    title: 'Смартфон X100',
    description: 'Мощный смартфон с отличной камерой',
    price: 599,
  },
  {
    id: uuidv4(),
    title: 'Наушники Pro',
    description: 'Беспроводные наушники с шумоподавлением',
    price: 199,
  },
  {
    id: uuidv4(),
    title: 'Умные часы',
    description: 'Спортивные часы с GPS и мониторингом сердца',
    price: 299,
  },
];

const stocks = products.map((product) => ({
  product_id: product.id,
  count: Math.floor(Math.random() * 10) + 1,
}));

async function seed() {
  for (const product of products) {
    await dynamoDB.send(new PutCommand({ TableName: 'products', Item: product }));
    console.log(`✅ Добавлен продукт: ${product.title}`);
  }

  for (const stock of stocks) {
    await dynamoDB.send(new PutCommand({ TableName: 'stocks', Item: stock }));
    console.log(`✅ Добавлен сток для продукта: ${stock.product_id}`);
  }

  console.log('🎉 Заполнение таблиц завершено!');
}

seed().catch(console.error);