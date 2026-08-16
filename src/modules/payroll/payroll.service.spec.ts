import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { DRIZZLE } from '../../database/database.module';

describe('PayrollService', () => {
  let service: PayrollService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        {
          provide: DRIZZLE,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
