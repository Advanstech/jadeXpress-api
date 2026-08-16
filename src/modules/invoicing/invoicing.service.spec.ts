import { Test, TestingModule } from '@nestjs/testing';
import { InvoicingService } from './invoicing.service';
import { DRIZZLE } from '../../database/database.module';

describe('InvoicingService', () => {
  let service: InvoicingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicingService,
        {
          provide: DRIZZLE,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<InvoicingService>(InvoicingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
